import { MAX_BACKUP_BYTES } from './vaultFormat.ts';
// Only authenticated ciphertext is retained across Android's external file picker.
let pending = '';
const listeners: Set<() => void> = new Set();
export const recoveryFiles = {
  get: () => pending,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  clear: () => {
    pending = '';
    listeners.forEach((fn) => fn());
  },
};
export async function pickEncryptedBackup() {
  const DocumentPicker = require('expo-document-picker') as typeof import('expo-document-picker');
  const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/octet-stream'],
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (result.canceled) return;
  const file = result.assets[0];
  if (
    !Number.isSafeInteger(file.size) ||
    !file.size ||
    file.size < 0 ||
    file.size > MAX_BACKUP_BYTES ||
    !/^(content|file):\/\//.test(file.uri)
  )
    throw new Error('Cannot safely read this file: missing size or backup exceeds 32 MiB.');
  // Bound the native read even if a document provider misreports its size.
  // The portable envelope is ASCII JSON (all sensitive content is hex ciphertext).
  const text = atob(
    await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: MAX_BACKUP_BYTES + 1,
    }),
  );
  if (text.length > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the size limit.');
  pending = text;
  listeners.forEach((fn) => fn());
}

export async function saveEncryptedBackup(ciphertext: string) {
  const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
  const grant = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!grant.granted) throw new Error('No backup folder selected. Nothing was exported.');
  const uri = await FileSystem.StorageAccessFramework.createFileAsync(
    grant.directoryUri,
    `Maivelle-Vault-${Date.now()}.json`,
    'application/json',
  );
  await FileSystem.writeAsStringAsync(uri, ciphertext);
}
