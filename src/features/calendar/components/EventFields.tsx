import { useState } from 'react';
import { Switch, TextInput, View } from 'react-native';
import { FileText, MapPin, Repeat2 } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { frequencies } from '../validation/eventInput.ts';
import { CalendarChip, CalendarChoices } from './CalendarControls.tsx';
import EventDateTimeField from './EventDateTimeField.tsx';
import EventCategoryPicker from './EventCategoryPicker.tsx';
import EventReminderPicker from './EventReminderPicker.tsx';
import { usePlanStyles } from './planStyles.ts';

export type EventFieldsProps = {
  form: import('../validation/eventForm.ts').EventForm;
  setForm: import('react').Dispatch<
    import('react').SetStateAction<import('../validation/eventForm.ts').EventForm>
  >;
  busy: boolean;
  occurrence: boolean;
  categories?: import('../../../database/repositories/calendarRepository.ts').CalendarCategory[];
  focusLocation?: boolean;
};

export default function EventFields({
  form,
  setForm,
  busy,
  occurrence,
  categories = [],
  focusLocation = false,
}: EventFieldsProps) {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  const [repeatOpen, setRepeatOpen] = useState(false);
  function text(key: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  const field = (
    label: string,
    key: keyof typeof form,
    max: number,
    Icon: LucideIcon = Repeat2,
    placeholder = label,
  ) => (
    <View style={styles.formGroup}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.fieldRow}>
        <View style={styles.fieldIcon}>
          <Icon size={19} color={colors.primary} accessible={false} />
        </View>
        <TextInput
          accessibilityLabel={label}
          value={String(form[key] ?? '')}
          onChangeText={(value) => text(key, value)}
          maxLength={max}
          editable={!busy}
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          autoFocus={key === 'location' && focusLocation}
        />
      </View>
    </View>
  );
  return (
    <View style={styles.section}>
      {field('Event title', 'title', 240, FileText, 'e.g. Project meeting (required)')}
      <View style={styles.switchRow}>
        <AppText variant="label">All-day event</AppText>
        <Switch
          accessibilityLabel="All-day event"
          value={form.allDay}
          onValueChange={(allDay) => setForm((value) => ({ ...value, allDay }))}
          disabled={busy}
          trackColor={{ true: colors.primary }}
        />
      </View>
      <View style={styles.columns}>
        <View style={styles.column}>
          <EventDateTimeField
            label="Start date *"
            value={form.startDate}
            kind="date"
            onChange={(value) =>
              setForm((previous) => ({
                ...previous,
                startDate: value,
                endDate: previous.endDate === previous.startDate ? value : previous.endDate,
              }))
            }
            disabled={busy}
          />
        </View>
        <View style={styles.column}>
          <EventDateTimeField
            label={form.allDay ? 'Last day (inclusive) *' : 'End date *'}
            value={form.endDate}
            kind="date"
            onChange={(value) => text('endDate', value)}
            disabled={busy}
          />
        </View>
      </View>
      {!form.allDay ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            <EventDateTimeField
              label="Start time *"
              value={form.startTime}
              kind="time"
              onChange={(value) => text('startTime', value)}
              disabled={busy}
            />
          </View>
          <View style={styles.column}>
            <EventDateTimeField
              label="End time *"
              value={form.endTime}
              kind="time"
              onChange={(value) => text('endTime', value)}
              disabled={busy}
            />
          </View>
        </View>
      ) : null}
      {field('Location', 'location', 500, MapPin, 'e.g. Office, online, or address')}
      <EventCategoryPicker
        categories={categories}
        value={form.categoryId}
        onChange={(categoryId) => setForm((value) => ({ ...value, categoryId }))}
        disabled={busy}
      />
      <EventReminderPicker
        value={form.reminderMinutes}
        disabled={busy}
        allDay={form.allDay}
        onChange={(reminderMinutes) => setForm((value) => ({ ...value, reminderMinutes }))}
      />
      <View style={styles.formGroup}>
        <AppText variant="label">Notes</AppText>
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <FileText size={19} color={colors.primary} accessible={false} />
          </View>
          <TextInput
            accessibilityLabel="Event description"
            value={form.description}
            onChangeText={(value) => text('description', value)}
            maxLength={100000}
            editable={!busy}
            style={[styles.textInput, styles.noteInput]}
            multiline
            placeholder="Add notes, agenda items, or links… (optional)"
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>
      {!occurrence ? (
        <>
          <AppButton
            label={`Repeat: ${form.frequency === 'none' ? 'Does not repeat' : form.frequency}`}
            variant="secondary"
            icon={Repeat2}
            disabled={busy}
            onPress={() => setRepeatOpen((value) => !value)}
          />
          {repeatOpen || form.frequency !== 'none' ? (
            <View style={styles.section}>
              <CalendarChoices>
                {['none', ...frequencies].map((frequency) => (
                  <CalendarChip
                    key={frequency}
                    label={frequency[0].toUpperCase() + frequency.slice(1)}
                    selected={form.frequency === frequency}
                    onPress={() => text('frequency', frequency)}
                    disabled={busy}
                  />
                ))}
              </CalendarChoices>
              {form.frequency !== 'none' ? (
                <>
                  {field('Repeat interval', 'interval', 3)}
                  {form.frequency === 'weekly' ? (
                    <CalendarChoices>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, day) => (
                        <CalendarChip
                          key={label}
                          label={label}
                          selected={form.weekdays.includes(day)}
                          disabled={busy}
                          onPress={() =>
                            setForm((value) => ({
                              ...value,
                              weekdays: value.weekdays.includes(day)
                                ? value.weekdays.filter((item) => item !== day)
                                : [...value.weekdays, day].sort(),
                            }))
                          }
                        />
                      ))}
                    </CalendarChoices>
                  ) : null}
                  <AppText variant="caption" tone="muted">
                    Optional: use an end date OR occurrence limit. Invalid month days and leap dates
                    are skipped.
                  </AppText>
                  {field('Repeat end date (YYYY-MM-DD, optional)', 'until', 10)}
                  {field('Occurrence limit (optional)', 'count', 5)}
                </>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
