import { useState } from 'react';
import { Alert } from 'react-native';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import VaultField from './VaultField.tsx';
import { useVault } from '../providers/VaultProvider.tsx';
import { saveEncryptedBackup } from '../services/vaultFiles.native.ts';
export default function VaultSecurity() {
  const { service, state } = useVault();
  const [old, setOld] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [backup, setBackup] = useState('');
  const [backupConfirm, setBackupConfirm] = useState('');
  const [message, setMessage] = useState('');
  async function changePassword() {
    const previous = old;
    const password = next;
    setOld('');
    setNext('');
    setConfirm('');
    setMessage('');
    try {
      if (password !== confirm) throw new Error('New master passwords do not match.');
      await service.changePassword(previous, password);
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : 'Password change failed.');
    }
  }
  async function exportBackup() {
    const password = backup;
    setBackup('');
    setBackupConfirm('');
    setMessage('');
    try {
      if (password !== backupConfirm) throw new Error('Backup passwords do not match.');
      const encrypted = await service.exportBackup(password);
      await saveEncryptedBackup(encrypted);
      Alert.alert(
        'Encrypted backup saved',
        'Keep its password separately. Old backups retain their old passwords and deleted records. Test recovery on an empty installation.',
      );
    } catch (failure) {
      Alert.alert(
        'Backup not completed',
        failure instanceof Error ? failure.message : 'Export failed.',
      );
    }
  }
  return (
    <ScreenContainer>
      <AppHeader title="Vault security" back />
      <AppText variant="heading">Master password</AppText>
      <AppText>
        Changing the master password rewraps the same random data key and locks the Vault. It
        disables biometric shortcuts. Older backups still use their original backup passwords.
      </AppText>
      <VaultField label="Current master password" value={old} onChange={setOld} secret />
      <VaultField label="New master password" value={next} onChange={setNext} secret />
      <VaultField
        label="Confirm new master password"
        value={confirm}
        onChange={setConfirm}
        secret
      />
      <AppButton
        label={state.busy ? 'Working securely…' : 'Change master password'}
        disabled={state.busy}
        onPress={() => {
          void changePassword();
        }}
      />
      <AppText variant="heading">Automatic locking</AppText>
      <AppText>
        Leaving Vault, backgrounding, Android loss of focus, restart and inactivity lock the Vault
        and clear its screens.
      </AppText>
      {[60, 300].map((seconds) => (
        <AppButton
          key={seconds}
          label={`Lock after ${seconds / 60} minute${seconds === 60 ? '' : 's'}`}
          variant="secondary"
          disabled={state.busy}
          onPress={() => {
            service
              .setTimeout(seconds)
              .then(() => setMessage('Inactivity limit updated.'))
              .catch(() => setMessage('Could not update inactivity limit.'));
          }}
        />
      ))}
      <AppText variant="heading">Optional biometrics</AppText>
      <AppText>
        Only strong enrolled biometrics protecting the device key through Android Keystore can
        enable this shortcut. Master-password unlock remains the fallback.
      </AppText>
      <AppButton
        label="Enable protected biometric unlock"
        disabled={state.busy}
        variant="secondary"
        onPress={() => {
          service
            .enableBiometrics()
            .then(() => setMessage('Protected biometric shortcut enabled.'))
            .catch((failure) =>
              setMessage(failure instanceof Error ? failure.message : 'Biometric setup failed.'),
            );
        }}
      />
      <AppButton
        label="Disable biometric unlock"
        disabled={state.busy}
        variant="secondary"
        onPress={() => {
          service
            .disableBiometrics()
            .then(() => setMessage('Biometric shortcut removed.'))
            .catch(() => setMessage('Could not remove biometric shortcut.'));
        }}
      />
      <AppText variant="heading">Portable encrypted backup</AppText>
      <AppText>
        Use a separate password of at least 12 characters. Select an on-device folder. Opening
        Android’s file picker locks the Vault; only ciphertext reaches the selected file. Recovery
        creates an empty Vault and never replaces existing data.
      </AppText>
      <VaultField label="Backup password" value={backup} onChange={setBackup} secret />
      <VaultField
        label="Confirm backup password"
        value={backupConfirm}
        onChange={setBackupConfirm}
        secret
      />
      <AppButton
        label="Create encrypted backup"
        disabled={state.busy}
        onPress={() => {
          void exportBackup();
        }}
      />
      {!!message && <AppText accessibilityLiveRegion="polite">{message}</AppText>}
      <AppButton label="Lock Vault" variant="secondary" onPress={() => service.lock()} />
    </ScreenContainer>
  );
}
