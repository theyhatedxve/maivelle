import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { router } from 'expo-router';
import { Pill } from 'lucide-react-native';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import EmptyState from '../../../components/ui/EmptyState.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { useMedicineQuery, medicineError } from '../hooks/useMedicine.ts';
import { MedicineError, MedicineStorageNotice, ReminderPermissions } from './MedicineControls.tsx';
import { useMedicineStyles } from './medicineStyles.ts';

export type MedicineDetailsProps = {
  id: string;
};

export default function MedicineDetails({ id }: MedicineDetailsProps) {
  const styles = useMedicineStyles();
  const { medicineService } = useDatabase();
  const query = useMedicineQuery(
    useCallback(
      () =>
        /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)
          ? medicineService.get(id)
          : Promise.resolve(null),
      [id, medicineService],
    ),
  );
  const medicine = query.data;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function toggle() {
    if (!medicine || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await medicineService.save(id, { ...medicine, active: !medicine.active }, medicine.revision);
    } catch (failure) {
      setError(medicineError(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <ScreenContainer>
      <AppHeader title="Medicine details" back />
      <View style={styles.section}>
        <MedicineStorageNotice />
        {query.loading ? (
          <ActivityIndicator />
        ) : query.error ? (
          <MedicineError
            message={query.error}
            retry={() => {
              void query.refresh();
            }}
          />
        ) : !medicine ? (
          <EmptyState
            icon={Pill}
            title="Medicine not found"
            description="Return to My medicines to choose an existing record."
          />
        ) : (
          <>
            <AppText variant="title">{medicine.name}</AppText>
            <AppText>
              {medicine.active ? 'Active' : 'Inactive'} · {medicine.form || 'No form entered'}
            </AppText>
            {medicine.instructions ? <AppText>{medicine.instructions}</AppText> : null}
            {medicine.notes ? <AppText tone="muted">{medicine.notes}</AppText> : null}
            <AppText>
              {medicine.startDate ?? 'No start date'} → {medicine.endDate ?? 'No end date'}
            </AppText>
            <View style={styles.row}>
              <AppButton
                label="Edit medicine"
                disabled={busy}
                onPress={() => router.push({ pathname: '/medicine/edit/[id]', params: { id } })}
              />
              <AppButton
                label="Medication history"
                variant="secondary"
                onPress={() => router.push({ pathname: '/medicine/history/[id]', params: { id } })}
              />
              <AppButton
                label={
                  busy ? 'Saving…' : medicine.active ? 'Deactivate medicine' : 'Reactivate medicine'
                }
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    medicine.active ? 'Deactivate medicine?' : 'Reactivate medicine?',
                    medicine.active
                      ? 'Future reminders stop. Earlier schedules and all dose records are preserved.'
                      : 'New schedule revisions start from now. Earlier history is preserved.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: medicine.active ? 'Deactivate' : 'Reactivate',
                        onPress: () => {
                          void toggle();
                        },
                      },
                    ],
                  )
                }
              />
            </View>
            {error ? <MedicineError message={error} /> : null}
            <AppText variant="heading">Current schedules</AppText>
            {!medicine.schedules.length && (
              <AppText>No schedules. This medicine will not create reminders.</AppText>
            )}
            {medicine.schedules.map((schedule, index) => (
              <View key={index} style={styles.notice}>
                <AppText variant="label">
                  Schedule {index + 1}:{' '}
                  {schedule.weekdays.length === 7
                    ? 'Daily'
                    : schedule.weekdays
                        .map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day])
                        .join(', ')}
                </AppText>
                <AppText>{schedule.times.join(', ')}</AppText>
                <AppText variant="caption">
                  {schedule.startDate ?? 'No schedule start'} →{' '}
                  {schedule.endDate ?? 'No schedule end'}
                </AppText>
              </View>
            ))}
            <AppButton
              label="Today's medications"
              variant="secondary"
              onPress={() => router.push('/medicine/today')}
            />
            <ReminderPermissions />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}
