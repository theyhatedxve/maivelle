import { router } from 'expo-router';
import { View } from 'react-native';
import AppButton from '../../../components/ui/AppButton.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import { useMedicineSummary } from '../hooks/useMedicine.ts';
import { useMedicineStyles } from './medicineStyles.ts';
export default function UpcomingMedicine() {
  const styles = useMedicineStyles();
  const query = useMedicineSummary();
  const upcoming =
    query.data?.doses
      .filter((dose) => !['taken', 'skipped', 'missed'].includes(dose.status))
      .slice(0, 3) ?? [];
  return (
    <View style={styles.section}>
      {query.error ? (
        <AppText>{query.error}</AppText>
      ) : (
        <AppText>
          {query.loading
            ? 'Loading medication summary…'
            : `${query.data?.taken ?? 0} taken · ${query.data?.skipped ?? 0} skipped · ${query.data?.scheduled ?? 0} scheduled today`}
        </AppText>
      )}
      {upcoming.map((dose) => (
        <AppButton
          key={dose.id}
          variant="secondary"
          label={`${dose.local.slice(11)} · ${dose.name}`}
          onPress={() =>
            router.push({ pathname: '/medicine/[id]', params: { id: dose.medicineId } })
          }
        />
      ))}
      <AppButton
        variant="secondary"
        label="Review today's medications"
        onPress={() => router.push('/medicine/today')}
      />
    </View>
  );
}
