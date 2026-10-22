import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import SettingsFrame, { PreferenceToggle, useSettingsAction } from './SettingsFrame.tsx';
import { useSettings } from '../providers/SettingsProvider.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { authenticateDevice } from '../services/deviceAuthentication.native.ts';
import { acquireVaultScreen } from '../../../services/security/vaultScreen.native.ts';
import VaultField from '../../vault/components/VaultField.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import { useAppAccess } from '../providers/AppSecurityGate.tsx';
import { confirmReplacement } from '../services/replacementConfirmation.ts';

export type BackupScreenProps = {
  settings: import('../providers/SettingsProvider.tsx').SettingsContext;
  replaceDatabase: (name: string) => Promise<void>;
};

export type BackupFormsProps = {
  settings: import('../providers/SettingsProvider.tsx').SettingsContext;
  replaceDatabase: (name: string) => Promise<void>;
};

export default function BackupSettings() {
  const settings = useSettings();
  const { replaceDatabase } = useDatabase();
  return <BackupScreen settings={settings} replaceDatabase={replaceDatabase} />;
}
/** Same protected forms for normal settings and an explicitly isolated development owner. */
export function BackupScreen({ settings, replaceDatabase }: BackupScreenProps) {
  const [protectedReady, setProtectedReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const lease = acquireVaultScreen();
    lease.ready
      .then(() => {
        if (alive) setProtectedReady(true);
      })
      .catch(() => {
        if (alive)
          setError(
            'Backup screen protection could not start. Restart Maivelle before entering passphrases.',
          );
      });
    return () => {
      alive = false;
      lease.release();
    };
  }, []);
  if (!protectedReady)
    return (
      <SettingsFrame title="Backup and Restore">
        <AppText>{error || 'Preparing protected backup screen…'}</AppText>
      </SettingsFrame>
    );
  return <BackupForms settings={settings} replaceDatabase={replaceDatabase} />;
}

function BackupForms({ settings, replaceDatabase }: BackupFormsProps) {
  const { backup, preferences, save } = settings;
  const action = useSettingsAction();
  const state = useSyncExternalStore(backup.subscribe, backup.getState, backup.getState);
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [restorePass, setRestorePass] = useState('');
  const [master, setMaster] = useState('');
  const [replacementConfirmation, setReplacementConfirmation] = useState({
    prepared: '',
    value: '',
  });
  const confirmation =
    replacementConfirmation.prepared === state.prepared ? replacementConfirmation.value : '';
  const access = useAppAccess();
  useEffect(
    () =>
      access.subscribe(() => {
        if (access.getState().locked) {
          setPass('');
          setConfirm('');
          setRestorePass('');
          setMaster('');
          setReplacementConfirmation({ prepared: '', value: '' });
        }
      }),
    [access],
  );
  const disabled = state.busy || action.busy;
  async function create() {
    if (pass !== confirm) throw new Error('Backup passphrases do not match.');
    const password = pass;
    setPass('');
    setConfirm('');
    await backup.create(password);
  }
  function requestExport() {
    if (preferences.confirmExternalBackup)
      Alert.alert(
        'Save encrypted local backup',
        'Choose a local folder. Android document providers may include cloud apps; choose device storage. Maivelle never uploads backups. Keep the passphrase and Vault master password separately.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Choose local folder',
            onPress: () => {
              void action.run(create);
            },
          },
        ],
      );
    else void action.run(create);
  }
  async function prepare() {
    const password = restorePass;
    const originalMaster = master;
    setRestorePass('');
    setMaster('');
    await backup.prepare(password, originalMaster);
  }
  function replace() {
    if (confirmation !== 'REPLACE') return;
    void action.run(async () => {
      const confirmed = await confirmReplacement(Alert.alert);
      setReplacementConfirmation({ prepared: '', value: '' });
      if (!confirmed) return false;
      await authenticateDevice();
      await replaceDatabase(backup.takePrepared());
    });
  }
  return (
    <SettingsFrame title="Backup and Restore">
      <AppText tone="muted">
        Encrypted backups include Notes, Tasks, Calendar, Medicine, Time Tracker, Finance, Budget,
        preferences and encrypted Vault records. Local-only; no automatic uploads. Maximum supported
        backup content: 64 MiB. Encrypted storage uses portable format 2. Legacy installations
        retain their format-1 snapshots; cross-format conversion requires migration review.
      </AppText>
      <AppCard>
        <AppText variant="title">Create a backup</AppText>
        <AppText tone="muted">
          Use a dedicated passphrase of at least 12 characters. Restoring the Vault also requires
          its original master password; Android Keystore keys do not transfer.
        </AppText>
        <VaultField label="Backup passphrase" value={pass} onChange={setPass} secret />
        <VaultField
          label="Confirm backup passphrase"
          value={confirm}
          onChange={setConfirm}
          secret
        />
        <AppButton
          label={state.busy ? 'Backup operation running…' : 'Create encrypted local backup'}
          disabled={disabled}
          onPress={requestExport}
        />
      </AppCard>
      <PreferenceToggle
        label="External backup explanation"
        value={preferences.confirmExternalBackup}
        disabled={disabled}
        onChange={(value) => {
          void action.run(() => save('confirmExternalBackup', value));
        }}
      />
      <AppCard>
        <AppText variant="title">Restore a backup</AppText>
        <AppText tone="muted">
          All authentication and schema checks happen in staging before replacement. A wrong
          password or damaged file never deletes current records. No automatic merging.
        </AppText>
        <AppButton
          label={state.selected ? 'Choose another local backup' : 'Choose local backup file'}
          variant="secondary"
          disabled={disabled}
          onPress={() => {
            void action.run(() => backup.pick());
          }}
        />
        <AppText>{state.selected ? 'Encrypted file selected' : 'No backup selected'}</AppText>
        <VaultField
          label="Restore backup passphrase"
          value={restorePass}
          onChange={setRestorePass}
          secret
        />
        <VaultField
          label="Original Vault master password (if configured)"
          value={master}
          onChange={setMaster}
          secret
        />
        <AppButton
          label="Verify and preview restore"
          disabled={disabled || !state.selected}
          onPress={() => {
            void action.run(prepare);
          }}
        />
        {state.preview ? (
          <>
            <AppText variant="label">Verified replacement preview</AppText>
            {Object.entries(state.preview).map(([key, value]) => (
              <AppText key={key}>
                {key === 'vaultVerified' ? 'Vault unlock verified' : key.replaceAll('_', ' ')}:{' '}
                {value}
              </AppText>
            ))}
            <VaultField
              label="Type REPLACE to enable replacement"
              value={confirmation}
              onChange={(value) => setReplacementConfirmation({ prepared: state.prepared, value })}
            />
            <AppButton
              label="Review and confirm replacement"
              disabled={disabled || confirmation !== 'REPLACE'}
              onPress={replace}
            />
            <AppButton
              label="Discard staged restore"
              variant="secondary"
              disabled={disabled}
              onPress={() => {
                void action.run(() => backup.discard());
              }}
            />
          </>
        ) : null}
      </AppCard>
      <AppText accessibilityLiveRegion="polite">{state.message}</AppText>
      <AppText accessibilityLiveRegion="polite">{action.message}</AppText>
      <AppText tone="muted">
        Losing both passwords and usable backups can permanently lose access. Old backups retain
        historical records and old passwords. Retained recovery points are device-local and do not
        protect against device loss. This build is for fictional data, pending production storage
        security review.
      </AppText>
    </SettingsFrame>
  );
}
