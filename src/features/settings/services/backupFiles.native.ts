import { File, Directory, Paths, FileMode } from 'expo-file-system';
import { MAX_LINE_BYTES, MAX_ARCHIVE_BYTES } from './backupFormat.ts';
const encoder = new TextEncoder();
export const archiveDirectory = new Directory(Paths.cache, 'maivelle-encrypted-backups');
/** Expo SQLite exposes Android absolute paths, whereas FileSystem requires absolute URIs. */
export function databaseFile(path: string, name: string = '') {
  const uri = path.startsWith('/') ? 'file://' + path : path;
  if (!uri.startsWith('file://')) throw new Error('Unsupported private database path.');
  return name ? new File(uri, name) : new File(uri);
}
export function ensureArchiveDirectory() {
  archiveDirectory.create({ intermediates: true, idempotent: true });
}

export function lineReader(file: File) {
  const handle = file.open(FileMode.ReadOnly);
  let pending = '';
  let ended = false;
  let total = 0;
  return {
    close: () => handle.close(),
    async nextLine() {
      while (true) {
        const position = pending.indexOf('\n');
        if (position >= 0) {
          const line = pending.slice(0, position);
          pending = pending.slice(position + 1);
          if (line.length > MAX_LINE_BYTES) throw new Error('Oversized backup line.');
          return line;
        }
        if (ended) {
          if (pending) throw new Error('Backup is incomplete.');
          return null;
        }
        const bytes = await handle.readBytes(16 * 1024);
        total += bytes.length;
        if (total > MAX_ARCHIVE_BYTES) throw new Error('Backup exceeds 192 MiB.');
        if (bytes.some((b) => b > 127)) throw new Error('Unsupported backup encoding.');
        pending += new TextDecoder().decode(bytes);
        ended = bytes.length === 0;
        if (pending.length > MAX_LINE_BYTES && !pending.includes('\n'))
          throw new Error('Oversized backup line.');
      }
    },
  };
}

export function fileWriter(file: File) {
  file.create();
  const handle = file.open(FileMode.WriteOnly);
  return {
    close: () => handle.close(),
    write: (bytes: Uint8Array) => handle.writeBytes(bytes),
    line: (value: string) => handle.writeBytes(encoder.encode(value + '\n')),
  };
}
export async function chooseBackup() {
  const picker = await import('expo-document-picker');
  const result = await picker.getDocumentAsync({
    type: ['application/json', 'application/octet-stream'],
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (result.canceled) return null;
  const item = result.assets[0];
  if (
    !Number.isSafeInteger(item.size) ||
    !item.size ||
    item.size > MAX_ARCHIVE_BYTES ||
    !/^(content|file):\/\//.test(item.uri)
  )
    throw new Error('Choose a bounded local Maivelle backup (maximum 192 MiB).');
  return item.uri;
}
/** Folder/document access is explicitly user-granted; no background/cloud destination. */
export async function exportArchive(source: File, verify: (destination: File) => Promise<void>) {
  const fs = await import('expo-file-system/legacy');
  const grant = await fs.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!grant.granted)
    throw new Error(
      'No folder chosen. The verified encrypted cache copy remains available until cleanup.',
    );
  const uri = await fs.StorageAccessFramework.createFileAsync(
    grant.directoryUri,
    `Maivelle-Backup-${Date.now()}.json`,
    'application/json',
  );
  const input = source.open(FileMode.ReadOnly);
  const output = new File(uri).open(FileMode.WriteOnly);
  try {
    while (true) {
      const bytes = await input.readBytes(128 * 1024);
      if (!bytes.length) break;
      await output.writeBytes(bytes);
    }
  } finally {
    input.close();
    output.close();
  }
  await verify(new File(uri));
  return uri;
}
export function cacheInformation() {
  if (!archiveDirectory.exists) return { bytes: 0, files: 0 };
  const files = archiveDirectory
    .list()
    .filter((file) => file instanceof File && /^backup-[0-9a-f]{32}\.json$/.test(file.name));
  return {
    bytes: files.reduce((sum, file) => sum + (file.size ?? 0), 0),
    files: files.length,
  };
}
export function cleanBackupCache() {
  if (!archiveDirectory.exists) return;
  for (const file of archiveDirectory.list())
    if (file instanceof File && /^backup-[0-9a-f]{32}\.json$/.test(file.name)) file.delete();
}
