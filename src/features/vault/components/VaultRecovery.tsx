import { useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import VaultField from './VaultField.tsx';
import { useVault } from '../providers/VaultProvider.tsx';
import { pickEncryptedBackup, recoveryFiles } from '../services/vaultFiles.native.ts';

export type VaultRecoveryProps = {
  onCancel: () => void;
};

export default function VaultRecovery({ onCancel }: VaultRecoveryProps) {
  const { service, state } = useVault();
  const text = useSyncExternalStore(recoveryFiles.subscribe, recoveryFiles.get, recoveryFiles.get);
  const [backupPassword, setBackupPassword] = useState('');
  const [master, setMaster] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  async function restore() {
    const pass = backupPassword;
    const next = master;
    setBackupPassword('');
    setMaster('');
    setConfirm('');
    setError('');
    try {
      if (next !== confirm) throw new Error('New master passwords do not match.');
      await service.restoreBackup(text, pass, next);
      recoveryFiles.clear();
      Alert.alert(
        'Vault recovered',
        'Unlock with your new master password. Keep the encrypted backup and its password safe.',
      );
      onCancel();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Recovery failed. No data was reset.');
    }
  }
  return (
    <>
      <AppText variant="heading">Encrypted backup recovery</AppText>
      <AppText>
        Choose a local file. Recovery only creates an empty Vault; it never replaces existing
        credentials. No password reset is possible without a usable backup password.
      </AppText>
      <AppButton
        label={text ? 'Choose another encrypted backup' : 'Choose encrypted backup'}
        disabled={state.busy}
        onPress={() => {
          pickEncryptedBackup().catch(() =>
            Alert.alert(
              'Backup unavailable',
              'The local encrypted backup could not be read. Check its size and file permissions.',
            ),
          );
        }}
      />
      {!!text && (
        <>
          <AppText>
            Encrypted backup selected. Its contents will be authenticated before any write.
          </AppText>
          <VaultField
            label="Backup password"
            value={backupPassword}
            onChange={setBackupPassword}
            secret
          />
          <VaultField label="New master password" value={master} onChange={setMaster} secret />
          <VaultField
            label="Confirm new master password"
            value={confirm}
            onChange={setConfirm}
            secret
          />
          <AppButton
            label={state.busy ? 'Recovering securely…' : 'Authenticate and recover'}
            disabled={state.busy}
            onPress={() => {
              void restore();
            }}
          />
        </>
      )}
      {!!error && <AppText>{error}</AppText>}
      <AppButton
        label="Back to Vault setup"
        disabled={state.busy}
        variant="secondary"
        onPress={onCancel}
      />
    </>
  );
}
