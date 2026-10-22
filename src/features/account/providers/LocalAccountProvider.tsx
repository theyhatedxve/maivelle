import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useSettings } from '../../settings/providers/SettingsProvider.tsx';
import { useVault } from '../../vault/providers/VaultProvider.tsx';
import { accountStore } from '../services/accountStore.native.ts';
import { createAccountService } from '../services/accountService.ts';
import { vaultCrypto } from '../../../services/security/vaultCrypto.native.ts';

const Context = createContext<ReturnType<typeof createAccountService> | null>(null);

export default function LocalAccountProvider({ children }: PropsWithChildren) {
  const { preferences, save } = useSettings();
  const [service] = useState(() =>
    createAccountService({
      store: accountStore,
      crypto: vaultCrypto,
      initialProfileCreated: preferences.localProfileCreated,
      markProfileCreated: () => save('localProfileCreated', true),
    }),
  );
  const { service: vault } = useVault();
  const state = useSyncExternalStore(service.subscribe, service.getState, service.getState);

  useEffect(() => {
    service.syncProfileMarker(preferences.localProfileCreated);
  }, [service, preferences.localProfileCreated]);

  useEffect(() => {
    void service.refresh();
    service.setForeground(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (next) => {
      service.setForeground(next === 'active');
      if (next !== 'active') vault.lock();
    });
    return () => {
      subscription.remove();
      service.lock();
    };
  }, [service, vault]);
  useEffect(() => {
    if (!state.unlocked) vault.lock();
  }, [state.unlocked, vault]);
  return <Context.Provider value={service}>{children}</Context.Provider>;
}

export function useLocalAccount() {
  const service = useContext(Context);
  if (!service) throw new Error('Local account provider is unavailable.');
  const state = useSyncExternalStore(service.subscribe, service.getState, service.getState);
  return { service, state };
}
