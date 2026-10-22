package expo.modules.maivellestorage

import android.util.AtomicFile
import android.system.Os
import android.system.OsConstants
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.RandomAccessFile
import java.nio.channels.FileLock
import java.util.UUID

/** Only nonsensitive journal/ownership IO. No cryptographic provider or key storage changes. */
class MaivelleStorageModule : Module() {
  private data class Lease(val token: String, val file: RandomAccessFile, val lock: FileLock)
  private val leases = mutableMapOf<String, Lease>()
  private val guard = Any()

  private fun directory(): File {
    val context = requireNotNull(appContext.reactContext)
    val dir = File(context.noBackupFilesDir, "maivelle-storage-v1")
    check(dir.isDirectory || dir.mkdirs()) { "Storage control directory unavailable." }
    return dir
  }

  private fun checkName(name: String) {
    require(name == "production" || Regex("probe-[0-9a-f]{32}").matches(name)) { "Invalid storage owner." }
  }

  private fun requireLease(name: String, token: String) {
    checkName(name)
    check(leases[name]?.let { it.token == token && it.lock.isValid } == true) { "Storage lease unavailable." }
  }

  override fun definition() = ModuleDefinition {
    Name("MaivelleStorage")

    AsyncFunction("acquire") { name: String ->
      synchronized(guard) {
        checkName(name)
        check(!leases.containsKey(name)) { "Storage is already owned." }
        val file = RandomAccessFile(File(directory(), "$name.lock"), "rw")
        try {
          val lock = file.channel.tryLock() ?: error("Storage is owned by another process.")
          val token = UUID.randomUUID().toString()
          leases[name] = Lease(token, file, lock)
          token
        } catch (error: Exception) {
          file.close()
          throw IllegalStateException("Storage ownership unavailable.")
        }
      }
    }

    AsyncFunction("readJournal") { name: String, token: String ->
      synchronized(guard) {
        requireLease(name, token)
        val base = File(directory(), "$name.json")
        val journal = AtomicFile(base)
        if (!base.exists() && !File(base.path + ".bak").exists() && !File(base.path + ".new").exists()) null else {
          journal.openRead().use { input ->
            val bytes = ByteArray(8193)
            var size = 0
            while (size < bytes.size) {
              val read = input.read(bytes, size, bytes.size - size)
              if (read < 0) break
              size += read
            }
            check(size <= 8192) { "Storage journal exceeds limit." }
            String(bytes, 0, size, Charsets.UTF_8)
          }
        }
      }
    }

    AsyncFunction("writeJournal") { name: String, token: String, value: String ->
      synchronized(guard) {
        requireLease(name, token)
        val bytes = value.toByteArray(Charsets.UTF_8)
        require(bytes.size in 1..8192) { "Invalid journal length." }
        val journal = AtomicFile(File(directory(), "$name.json"))
        val output = journal.startWrite()
        try {
          output.write(bytes)
          journal.finishWrite(output) // AtomicFile syncs before publishing the replacement.
          val parent = Os.open(directory().absolutePath, OsConstants.O_RDONLY, 0)
          try { Os.fsync(parent) } finally { Os.close(parent) }
        } catch (error: Exception) {
          journal.failWrite(output)
          throw IllegalStateException("Storage journal commit failed.")
        }
      }
    }

    AsyncFunction("release") { name: String, token: String ->
      synchronized(guard) {
        requireLease(name, token)
        val lease = requireNotNull(leases.remove(name))
        try { lease.lock.release() } finally { lease.file.close() }
      }
    }

    AsyncFunction("removeProbeJournal") { name: String, token: String ->
      synchronized(guard) {
        requireLease(name, token)
        require(name.startsWith("probe-")) { "Production journals cannot be removed." }
        AtomicFile(File(directory(), "$name.json")).delete()
      }
    }

    OnDestroy {
      synchronized(guard) {
        leases.values.forEach { lease ->
          try { lease.lock.release() } finally { lease.file.close() }
        }
        leases.clear()
      }
    }
  }
}
