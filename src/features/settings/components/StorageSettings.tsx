import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import SettingsFrame, { useSettingsAction } from './SettingsFrame.tsx';
import { useSettings } from '../providers/SettingsProvider.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
const size = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2) + ' MiB';
export default function StorageSettings() {
  const { backup } = useSettings();
  const action = useSettingsAction();
  const [info, setInfo] = useState(null as Awaited<ReturnType<typeof backup.storage>> | null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    backup
      .storage()
      .then((value) => {
        if (alive) setInfo(value);
      })
      .catch(() => {
        if (alive) setError('Storage information is unavailable. No files were removed.');
      });
    return () => {
      alive = false;
    };
  }, [backup, action.message]);
  return (
    <SettingsFrame title="Storage Information">
      <AppText>{error}</AppText>
      {info ? (
        <>
          <AppText>Active database: {size(info.databaseBytes)}</AppText>
          <AppText>SQLite write-ahead log: {size(info.walBytes)}</AppText>
          <AppText>Latest local recovery generation: {size(info.recoveryBytes)}</AppText>
          <AppText>
            Encrypted backup cache: {size(info.cache.bytes)} ({info.cache.files} files)
          </AppText>
          <AppText>Available device space: {size(info.freeBytes)}</AppText>
        </>
      ) : (
        <AppText>Reading local storage information…</AppText>
      )}
      <AppText tone="muted">
        External backups are user-managed documents; their total storage cannot be inferred from
        Android folder permissions. The previous database is retained after restore. Cleanup never
        removes it, user records or Vault keys.
      </AppText>
      <AppButton
        label="Clean encrypted backup cache"
        variant="secondary"
        disabled={action.busy}
        onPress={() =>
          Alert.alert(
            'Remove cached encrypted backups?',
            'Only Maivelle-owned temporary encrypted archive copies will be deleted. Externally saved backups, databases, recovery points and keys remain.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Clean cache',
                onPress: () => {
                  void action.run(() => backup.cleanup());
                },
              },
            ],
          )
        }
      />
      <AppText accessibilityLiveRegion="polite">{action.message}</AppText>
    </SettingsFrame>
  );
}
