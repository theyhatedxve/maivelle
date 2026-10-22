import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState, View, Modal } from 'react-native';
import { useSettings } from './SettingsProvider.tsx';
import { authenticateDevice } from '../services/deviceAuthentication.native.ts';
import { acquireVaultScreen } from '../../../services/security/vaultScreen.native.ts';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { createAppLockService } from '../services/appLockService.ts';
import { useVault } from '../../vault/providers/VaultProvider.tsx';

export type AppSecurityGateProps = {
  children: import('react').ReactNode;
};

const AppAccessContext = createContext(null as ReturnType<typeof createAppLockService> | null);
export function useAppAccess() {
  const service = useContext(AppAccessContext);
  if (!service) throw new Error('App access gate is unavailable.');
  return service;
}

export default function AppSecurityGate({ children }: AppSecurityGateProps) {
  const { preferences } = useSettings();
  const { colors } = useTheme();
  const { service: vault } = useVault();
  const service = useMemo(() => createAppLockService(authenticateDevice), []);
  const state = useSyncExternalStore(service.subscribe, service.getState, service.getState);
  const [error, setError] = useState('');
  const request = useMemo(
    () => ({ enabled: preferences.protectScreens }),
    [preferences.protectScreens],
  );
  const [protectedOwner, setProtectedOwner] = useState(null as object | null);
  useEffect(() => {
    if (preferences.appLock && state.locked) vault.lock();
  }, [preferences.appLock, state.locked, vault]);
  useEffect(() => {
    service.configure(preferences.appLock, preferences.inactivitySeconds);
  }, [service, preferences.appLock, preferences.inactivitySeconds]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') service.lock();
    });
    const timer = setInterval(() => service.check(), 1000);
    return () => {
      subscription.remove();
      clearInterval(timer);
      service.lock();
    };
  }, [service]);
  useEffect(() => {
    if (!preferences.protectScreens) return;
    let active = true;
    const lease = acquireVaultScreen();
    lease.ready
      .then(() => {
        if (active) setProtectedOwner(request);
      })
      .catch(() => {
        if (active) setError('Screen protection is unavailable. Restart the development build.');
      });
    return () => {
      active = false;
      lease.release();
    };
  }, [preferences.protectScreens, request]);
  async function unlock() {
    if (state.busy) return;
    setError('');
    try {
      await service.unlock();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Authentication failed.');
    }
  }
  const blocked = preferences.appLock && state.locked;
  const covered = blocked || (preferences.protectScreens && protectedOwner !== request);
  // Expo Router's root navigator must remain mounted. Removing it after navigation
  // exposed Home on this device instead of reliably presenting the lock screen.
  return (
    <AppAccessContext.Provider value={service}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{ flex: 1, opacity: covered ? 0 : 1 }}
          pointerEvents={covered ? 'none' : 'auto'}
          importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
          onTouchStart={() => service.touch()}
        >
          {children}
        </View>
        <Modal
          visible={covered}
          animationType="none"
          transparent={false}
          onRequestClose={() => {}}
          statusBarTranslucent
          navigationBarTranslucent
        >
          <ScreenContainer>
            <AppText variant="title">Maivelle is locked</AppText>
            <AppText tone="muted">
              Android device authentication controls app access. The Vault still requires its own
              key authorization.
            </AppText>
            {error ? <AppText>{error}</AppText> : null}
            {blocked ? (
              <AppButton
                label={state.busy ? 'Authenticating…' : 'Unlock Maivelle'}
                disabled={state.busy}
                onPress={() => {
                  void unlock();
                }}
              />
            ) : (
              <AppText>Preparing screen protection…</AppText>
            )}
          </ScreenContainer>
        </Modal>
      </View>
    </AppAccessContext.Provider>
  );
}
