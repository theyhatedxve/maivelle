import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { Switch, TextInput, View } from 'react-native';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { blankSchedule } from '../hooks/useMedicineEditor.ts';
import { MedicineChip } from './MedicineControls.tsx';
import { useMedicineStyles } from './medicineStyles.ts';

export type MedicineFieldsProps = {
  form: import('../hooks/useMedicineEditor.ts').MedicineForm;
  setForm: import('react').Dispatch<
    import('react').SetStateAction<import('../hooks/useMedicineEditor.ts').MedicineForm>
  >;
  busy: boolean;
};

export default function MedicineFields({ form, setForm, busy }: MedicineFieldsProps) {
  const styles = useMedicineStyles();
  const { colors } = useTheme();

  const field = (
    key: 'name' | 'form' | 'instructions' | 'notes' | 'startDate' | 'endDate',
    label: string,
    max: number,
    multiline: boolean = false,
  ) => (
    <View style={styles.section}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={colors.muted}
        value={form[key]}
        onChangeText={(value) => setForm((previous) => ({ ...previous, [key]: value }))}
        maxLength={max}
        editable={!busy}
        style={[styles.input, multiline && styles.body]}
        multiline={multiline}
      />
    </View>
  );

  const schedule = (
    index: number,
    update: Partial<import('../hooks/useMedicineEditor.ts').ScheduleForm>,
  ) =>
    setForm((previous) => ({
      ...previous,
      schedules: previous.schedules.map((item, position) =>
        position === index ? { ...item, ...update } : item,
      ),
    }));
  return (
    <View style={styles.section}>
      {field('name', 'Medicine name (required)', 240)}
      {field('form', 'Medication form (optional)', 120)}
      {field('instructions', 'Your dosage instructions (optional)', 2000, true)}
      {field('notes', 'Medication notes (optional)', 10000, true)}
      <View style={styles.row}>
        <AppText>Active</AppText>
        <Switch
          accessibilityLabel="Medicine active"
          value={form.active}
          onValueChange={(active) => setForm((previous) => ({ ...previous, active }))}
          disabled={busy}
          trackColor={{ true: colors.primary }}
        />
      </View>
      {field('startDate', 'Medicine start date (YYYY-MM-DD, optional)', 10)}
      {field('endDate', 'Medicine end date (YYYY-MM-DD, optional)', 10)}
      <AppText variant="heading">Schedules</AppText>
      <AppText tone="muted">
        Times use the local phone clock. Enter 24-hour times separated by commas. Dates are
        inclusive. All weekdays selected means daily. Leave no schedules for an unscheduled
        medicine.
      </AppText>
      {form.schedules.map((item, index) => (
        <AppCard key={index}>
          <View style={styles.section}>
            <AppText variant="heading">Schedule {index + 1}</AppText>
            <View style={styles.row}>
              <MedicineChip
                label="Daily"
                selected={item.weekdays.length === 7}
                onPress={() => schedule(index, { weekdays: [0, 1, 2, 3, 4, 5, 6] })}
                disabled={busy}
              />
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, value) => (
                <MedicineChip
                  key={day}
                  label={day}
                  selected={item.weekdays.includes(value)}
                  disabled={busy}
                  onPress={() =>
                    schedule(index, {
                      weekdays: item.weekdays.includes(value)
                        ? item.weekdays.filter((weekday) => weekday !== value)
                        : [...item.weekdays, value].sort(),
                    })
                  }
                />
              ))}
            </View>
            <AppText variant="label">Times · for example 08:00, 20:00</AppText>
            <TextInput
              accessibilityLabel={`Schedule ${index + 1} times`}
              style={styles.input}
              value={item.timesText}
              onChangeText={(timesText) => schedule(index, { timesText })}
              editable={!busy}
              maxLength={100}
              placeholder="HH:mm, HH:mm"
            />
            <AppText variant="label">Schedule start date (optional)</AppText>
            <TextInput
              accessibilityLabel={`Schedule ${index + 1} start date`}
              style={styles.input}
              value={item.startDate}
              onChangeText={(startDate) => schedule(index, { startDate })}
              editable={!busy}
              maxLength={10}
              placeholder="YYYY-MM-DD"
            />
            <AppText variant="label">Schedule end date (optional)</AppText>
            <TextInput
              accessibilityLabel={`Schedule ${index + 1} end date`}
              style={styles.input}
              value={item.endDate}
              onChangeText={(endDate) => schedule(index, { endDate })}
              editable={!busy}
              maxLength={10}
              placeholder="YYYY-MM-DD"
            />
            <AppButton
              label={`Remove schedule ${index + 1}`}
              variant="secondary"
              disabled={busy}
              onPress={() =>
                setForm((previous) => ({
                  ...previous,
                  schedules: previous.schedules.filter((_, position) => position !== index),
                }))
              }
            />
          </View>
        </AppCard>
      ))}
      <AppButton
        label="Add schedule"
        variant="secondary"
        disabled={busy || form.schedules.length >= 8}
        onPress={() =>
          setForm((previous) => ({
            ...previous,
            schedules: [...previous.schedules, blankSchedule()],
          }))
        }
      />
      <AppText variant="caption" tone="muted">
        Editing schedules, name, instructions, dates or active status preserves earlier revisions
        and dose history. New revisions take effect from the save time. Future doses are reconciled
        automatically.
      </AppText>
    </View>
  );
}
