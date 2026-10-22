import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState, View } from 'react-native';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { createVaultService } from '../services/vaultService.ts';
import { vaultCrypto } from '../../../services/security/vaultCrypto.native.ts';
import { clearVaultClipboard } from '../../../services/security/vaultClipboard.native.ts';
import { vaultBiometrics } from '../../../services/security/vaultBiometrics.native.ts';

export type VaultProviderProps = {
  children: import('react').ReactNode;
};

export type VaultService = ReturnType<typeof createVaultService>;

const VaultContext = createContext(null as VaultService | null);

export default function VaultProvider({ children }: VaultProviderProps) {
  const { vaultRepository } = useDatabase();
  const service = useMemo(
    () =>
      createVaultService(vaultRepository, vaultCrypto, {
        biometrics: vaultBiometrics,
      }),
    [vaultRepository],
  );
  const [error, setError] = useState('');
  useEffect(() => {
    service
      .refresh()
      .catch(() =>
        setError('Vault metadata could not load. Open Vault to retry; no data was reset.'),
      );
    const app = AppState.addEventListener('change', (state) => {
      if (state !== 'active') service.lock();
      else
        void clearVaultClipboard().catch(() =>
          console.warn('[Vault] Clipboard cleanup unavailable; cleanup remains best effort.'),
        );
    });
    const blur = AppState.addEventListener('blur', () => {
      if (!service.isBiometricPrompt()) service.lock();
    });
    const clearOnLock = service.subscribe(() => {
      if (service.getState().locked)
        void clearVaultClipboard().catch(() =>
          console.warn('[Vault] Clipboard cleanup unavailable; cleanup remains best effort.'),
        );
    });
    const timer = setInterval(() => service.checkInactivity(), 1000);
    return () => {
      app.remove();
      blur.remove();
      clearInterval(timer);
      clearOnLock();
      service.lock();
    };
  }, [service]);
  return (
    <VaultContext.Provider value={service}>
      <View
        style={{ flex: 1 }}
        onTouchStart={() => service.touch()}
        accessibilityHint={error || undefined}
      >
        {children}
      </View>
    </VaultContext.Provider>
  );
}
export function useVault() {
  const service = useContext(VaultContext);
  if (!service) throw new Error('Vault provider is unavailable.');
  const state = useSyncExternalStore(service.subscribe, service.getState, service.getState);
  return { service, state };
}
