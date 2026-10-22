import * as SecureStore from 'expo-secure-store';

const KEY = 'maivelle.local-account.v1';
const options: SecureStore.SecureStoreOptions = {
  keychainService: 'maivelle.local-account.v1',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Device-local access metadata. Never uses SQLite, AsyncStorage or Vault key slots. */
export const accountStore = {
  read: () => SecureStore.getItemAsync(KEY, options),
  write: (value: string) => SecureStore.setItemAsync(KEY, value, options),
};
