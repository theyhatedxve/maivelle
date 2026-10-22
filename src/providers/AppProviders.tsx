import type { PropsWithChildren } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DatabaseProvider from '../database/DatabaseProvider.tsx';
import SettingsProvider, { useSettings } from '../features/settings/providers/SettingsProvider.tsx';
import AppSecurityGate from '../features/settings/providers/AppSecurityGate.tsx';
import VaultProvider from '../features/vault/providers/VaultProvider.tsx';
import MedicineNotificationsProvider from '../services/notifications/MedicineNotificationsProvider.tsx';
import CalendarNotificationsProvider from '../services/notifications/CalendarNotificationsProvider.tsx';
import ThemeProvider, { useTheme } from '../theme/ThemeProvider.tsx';

/** Provider order is intentional: storage, preferences/theme, Vault, app access, reminders. */
export default function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <SettingsProvider>
          <ConfiguredTheme>
            <ThemedStatusBar />
            <VaultProvider>
              <AppSecurityGate>
                <MedicineNotificationsProvider>
                  <CalendarNotificationsProvider>{children}</CalendarNotificationsProvider>
                </MedicineNotificationsProvider>
              </AppSecurityGate>
            </VaultProvider>
          </ConfiguredTheme>
        </SettingsProvider>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}

function ConfiguredTheme({ children }: PropsWithChildren) {
  const { preferences } = useSettings();
  return <ThemeProvider appearance={preferences.appearance}>{children}</ThemeProvider>;
}

function ThemedStatusBar() {
  const { dark } = useTheme();
  return <StatusBar style={dark ? 'light' : 'dark'} />;
}
