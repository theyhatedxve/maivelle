package expo.modules.maivellecrypto

import android.os.Looper
import android.os.Handler
import android.os.PersistableBundle
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.util.Log
import java.util.UUID
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.bouncycastle.crypto.generators.SCrypt

class MaivelleCryptoModule : Module() {
  // Bound peak memory to one full-cost operation per process.
  private val derivationLock = Mutex()
  private var clipboardToken: String? = null

  private fun clearOwnedClipboard(): Boolean {
    val context = appContext.reactContext ?: return false
    val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val token = clipboardToken ?: return true
    val description = manager.primaryClipDescription ?: return false
    if (description.extras?.getString("maivelle.owner") == token) {
      if (Build.VERSION.SDK_INT >= 28) manager.clearPrimaryClip()
      else manager.setPrimaryClip(ClipData.newPlainText("", ""))
    }
    clipboardToken = null
    return true
  }

  override fun definition() = ModuleDefinition {
    Name("MaivelleCrypto")

    AsyncFunction("copySensitive") Coroutine { value: String ->
      require(value.length in 1..1024) { "Invalid clipboard value length." }
      withContext(Dispatchers.Main) {
        val context = requireNotNull(appContext.reactContext)
        val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val token = UUID.randomUUID().toString()
        val clip = ClipData.newPlainText("Maivelle", value)
        clip.description.extras = PersistableBundle().apply {
          putBoolean("android.content.extra.IS_SENSITIVE", true)
          putString("maivelle.owner", token)
        }
        manager.setPrimaryClip(clip)
        clipboardToken = token
        Handler(Looper.getMainLooper()).postDelayed({
          if (clipboardToken == token) runCatching { clearOwnedClipboard() }
            .onFailure { Log.w("MaivelleVault", "Clipboard cleanup unavailable; no replacement clip was modified") }
        }, 30000)
      }
    }

    AsyncFunction("clearOwnedClipboard") Coroutine { _: Boolean ->
      withContext(Dispatchers.Main) { clearOwnedClipboard() }
    }

    AsyncFunction("deriveWrappingKey") Coroutine { password: ByteArray, salt: ByteArray ->
      require(password.size in 12..1024) { "Master password must use 12–1024 UTF-8 bytes." }
      require(salt.size == 32) { "Vault KDF salt must contain 32 bytes." }
      try {
        derivationLock.withLock {
          withContext(Dispatchers.Default) {
            check(Looper.myLooper() != Looper.getMainLooper()) { "KDF must not run on Android main thread." }
            SCrypt.generate(password, salt, 131072, 8, 1, 32)
          }
        }
      } finally {
        password.fill(0)
        salt.fill(0)
      }
    }

    // Only public, fixed RFC fixture; no caller-controlled cost or low-cost key API.
    AsyncFunction("verifyRfcVector") Coroutine { _: Boolean ->
      withContext(Dispatchers.Default) {
        val output = SCrypt.generate(byteArrayOf(), byteArrayOf(), 16, 1, 1, 64)
        try {
          output.joinToString("") { "%02x".format(it.toInt() and 255) } ==
            "77d6576238657b203b19ca42c18a0497f16b4844e3074ae8dfdffa3fede21442fcd0069ded0948f8326a753a0fc81f17e8d3e0fb2e0d3628cf35e20c38d18906"
        } finally { output.fill(0) }
      }
    }
  }
}
