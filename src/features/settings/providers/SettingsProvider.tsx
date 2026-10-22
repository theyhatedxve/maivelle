import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { preferenceDefaults } from '../model/preferences.ts';
import { createBackupService } from '../services/backupService.native.ts';
import { authenticateDevice } from '../services/deviceAuthentication.native.ts';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';

export type SettingsProviderProps = {
  children: import('react').ReactNode;
};

export type SettingsContext = {
  preferences: import('../model/preferences.ts').Preferences;
  save: (key: string, value: unknown) => Promise<void>;
  backup: ReturnType<typeof createBackupService>;
};

const Context = createContext(null as SettingsContext | null);

export default function SettingsProvider({ children }: SettingsProviderProps) {
  const { settingsRepository } = useDatabase();
  const backup = useMemo(
    () => createBackupService(),
    [
      /* service is app-owned until database tree remount */
    ],
  );
  const [preferences, setPreferences] = useState(
    null as import('../model/preferences.ts').Preferences | null,
  );
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    settingsRepository
      .read()
      .then((value) => {
        if (alive) setPreferences(value);
      })
      .catch(() => {
        if (alive)
          setError(
            'Preferences could not load. Access is blocked rather than bypassing a configured lock. No data was reset.',
          );
      });
    return () => {
      alive = false;
    };
  }, [settingsRepository, attempt]);
  if (error)
    return (
      <ScreenContainer>
        <AppText>{error}</AppText>
        <AppButton
          label="Retry preferences"
          onPress={() => {
            setError('');
            setAttempt((n) => n + 1);
          }}
        />
      </ScreenContainer>
    );
  if (!preferences)
    return (
      <ScreenContainer>
        <AppText>Loading local preferences…</AppText>
      </ScreenContainer>
    );
  async function save(key: string, value: unknown) {
    if (['appLock', 'inactivitySeconds', 'protectScreens', 'localPinIdleLock'].includes(key))
      await authenticateDevice();
    await settingsRepository.write(key, value);
    setPreferences(await settingsRepository.read());
  }
  return <Context.Provider value={{ preferences, save, backup }}>{children}</Context.Provider>;
}
export function useSettings() {
  const value = useContext(Context);
  if (!value) throw new Error('Settings are not ready.');
  return value;
}
export { preferenceDefaults };
