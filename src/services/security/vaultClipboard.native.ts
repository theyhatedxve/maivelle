import { requireNativeModule } from 'expo';
let owned = false;

export async function copyVaultPassword(password: string, current: () => boolean = () => true) {
  await requireNativeModule('MaivelleCrypto').copySensitive(password);
  owned = true;
  if (!current()) await clearVaultClipboard();
}
export async function clearVaultClipboard() {
  if (!owned) return;
  if (await requireNativeModule('MaivelleCrypto').clearOwnedClipboard(true)) owned = false;
}
