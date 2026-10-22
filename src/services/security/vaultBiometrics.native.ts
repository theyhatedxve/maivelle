const KEY = 'vault-device-key';
const MARKER = 'vault-biometric-option';
const options = {
  keychainService: 'Maivelle.Vault.Biometric.v1',
  requireAuthentication: true,
  authenticationPrompt: 'Unlock Maivelle Vault',
};
const markerOptions = { keychainService: 'Maivelle.Vault.Options.v1' };
const store = () => require('expo-secure-store') as typeof import('expo-secure-store');

export const vaultBiometrics: import('../../features/vault/services/types').BiometricStore = {
  async available() {
    const auth = require('expo-local-authentication') as typeof import('expo-local-authentication');
    return (
      store().canUseBiometricAuthentication() &&
      (await auth.getEnrolledLevelAsync()) === auth.SecurityLevel.BIOMETRIC_STRONG
    );
  },
  async has() {
    return (await store().getItemAsync(MARKER, markerOptions)) === 'enabled';
  },
  async read() {
    return store().getItemAsync(KEY, options);
  },
  async write(value) {
    await store().setItemAsync(KEY, value, options);
    await store().setItemAsync(MARKER, 'enabled', markerOptions);
  },
  async remove() {
    await store().deleteItemAsync(KEY, options);
    await store().deleteItemAsync(MARKER, markerOptions);
  },
};
