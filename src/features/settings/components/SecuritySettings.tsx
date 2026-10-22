import { router } from 'expo-router';
import SettingsFrame, { PreferenceToggle, useSettingsAction } from './SettingsFrame.tsx';
import { useSettings } from '../providers/SettingsProvider.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import LocalProfileSettings from '../../account/components/LocalProfileSettings.tsx';
export default function SecuritySettings() {
  const { preferences, save } = useSettings();
  const action = useSettingsAction();
  return (
    <SettingsFrame title="Privacy and Security">
      <LocalProfileSettings />
      <PreferenceToggle
        label="Lock PIN while idle"
        value={preferences.localPinIdleLock}
        disabled={action.busy}
        onChange={(value) => {
          void action.run(() => save('localPinIdleLock', value));
        }}
      />
      <AppText tone="muted">
        Off disables the local PIN inactivity timer. Backgrounding or restarting still requires your
        PIN. The optional Android app lock and Vault have their own timers.
      </AppText>
      <AppText tone="muted">
        The optional additional app lock uses Android device authentication. It does not replace
        your local profile PIN, unwrap the Vault key or replace the Vault master password. Android
        must have a secure screen lock.
      </AppText>
      <PreferenceToggle
        label="App lock"
        value={preferences.appLock}
        disabled={action.busy}
        onChange={(value) => {
          void action.run(() => save('appLock', value));
        }}
      />
      <AppText variant="label">App inactivity timeout</AppText>
      {[60, 300].map((seconds) => (
        <AppButton
          key={seconds}
          label={`${seconds / 60} minute${seconds === 60 ? '' : 's'}${preferences.inactivitySeconds === seconds ? ' — selected' : ''}`}
          variant="secondary"
          disabled={action.busy}
          onPress={() => {
            void action.run(() => save('inactivitySeconds', seconds));
          }}
        />
      ))}
      <AppText tone="muted">
        When app lock is enabled, backgrounding locks immediately. Its inactivity timer is separate
        from the Vault timer. Security changes require Android reauthentication.
      </AppText>
      <PreferenceToggle
        label="Screen protection"
        value={preferences.protectScreens}
        disabled={action.busy}
        onChange={(value) => {
          void action.run(() => save('protectScreens', value));
        }}
      />
      <AppText tone="muted">
        Screen protection blocks captures across the app when enabled. Vault and backup passphrase
        screens always request protection independently. Keyboard and operating-system memory cannot
        be guaranteed erased.
      </AppText>
      <AppButton
        label="Vault password, biometrics and auto-lock"
        variant="secondary"
        onPress={() => router.push('/vault/security')}
      />
      <AppText tone="muted">
        No analytics or remote authentication is used. This development database is unkeyed;
        encrypted Vault fields and backups do not make other records encrypted. Use fictional
        information only.
      </AppText>
      <AppText accessibilityLiveRegion="polite">{action.message}</AppText>
    </SettingsFrame>
  );
}
