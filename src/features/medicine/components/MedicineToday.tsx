import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, View, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Pill } from 'lucide-react-native';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import EmptyState from '../../../components/ui/EmptyState.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { addDays, localToday, validateDate } from '../../calendar/services/calendarDates.ts';
import { useMedicineQuery } from '../hooks/useMedicine.ts';
import { MISSED_GRACE_MINUTES } from '../services/doseOccurrences.ts';
import { MedicineError, MedicineStorageNotice, ReminderPermissions } from './MedicineControls.tsx';
import DoseCard from './DoseCard.tsx';
import { useMedicineStyles } from './medicineStyles.ts';

export type MedicineTodayProps = {
  medicineId?: string;
};

export default function MedicineToday({ medicineId }: MedicineTodayProps) {
  const styles = useMedicineStyles();
  const { medicineService } = useDatabase();
  const [date, setDate] = useState(localToday());
  const history = medicineId !== undefined;
  const query = useMedicineQuery(
    useCallback(async () => {
      validateDate(date);
      return medicineService.doses(date, addDays(date, history ? 7 : 1), medicineId ?? null);
    }, [date, history, medicineId, medicineService]),
  );
  const total = query.data?.length ?? 0;
  const taken = query.data?.filter((dose) => dose.status === 'taken').length ?? 0;
  const skipped = query.data?.filter((dose) => dose.status === 'skipped').length ?? 0;
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(dose) => dose.id}
        renderItem={({ item }) => <DoseCard dose={item} />}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshing={query.loading}
        onRefresh={() => {
          void query.refresh();
        }}
        initialNumToRender={10}
        ListHeaderComponent={
          <View style={styles.section}>
            <AppHeader
              title={history ? 'Medication history' : "Today's medications"}
              subtitle={
                history
                  ? 'Seven-day window · Recorded actions are final'
                  : 'Scheduled on this device'
              }
              back
            />
            <MedicineStorageNotice />
            <View style={styles.row}>
              <AppButton
                label="Previous"
                variant="secondary"
                onPress={() => {
                  try {
                    setDate(addDays(validateDate(date), history ? -7 : -1));
                  } catch {
                    setDate(localToday());
                  }
                }}
              />
              <AppButton label="Today" variant="secondary" onPress={() => setDate(localToday())} />
              <AppButton
                label="Next"
                variant="secondary"
                onPress={() => {
                  try {
                    setDate(addDays(validateDate(date), history ? 7 : 1));
                  } catch {
                    setDate(localToday());
                  }
                }}
              />
              <AppButton label="My medicines" onPress={() => router.push('/medicine')} />
            </View>
            <TextInput
              accessibilityLabel="Dose date"
              style={styles.input}
              value={date}
              onChangeText={setDate}
              maxLength={10}
              placeholder="YYYY-MM-DD"
            />
            <AppText>
              {history
                ? `${date} through ${(() => {
                    try {
                      return addDays(validateDate(date), 6);
                    } catch {
                      return '…';
                    }
                  })()}`
                : date}{' '}
              · {taken} taken · {skipped} skipped · {total} scheduled
            </AppText>
            <AppText variant="caption" tone="muted">
              Missed means no recorded action {MISSED_GRACE_MINUTES} minutes after the scheduled
              time. It does not prove a dose was not taken. Taken/Skipped become available at the
              scheduled time; notifications never record an action.
            </AppText>
            {!history && <ReminderPermissions />}
            {query.error ? (
              <MedicineError
                message={query.error}
                retry={() => {
                  void query.refresh();
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.loading ? (
            <ActivityIndicator />
          ) : !query.error ? (
            <EmptyState
              icon={Pill}
              title="No scheduled doses"
              description="Add an active fictional medicine with a schedule, or select another date."
            />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}
