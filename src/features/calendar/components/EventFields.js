import { Switch, TextInput, View } from 'react-native';
import AppText from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { frequencies } from '../validation/eventInput';
import { CalendarChip, CalendarChoices } from './CalendarControls';
import { calendarStyles as styles } from './calendarStyles';

/** @param {{form: import('../validation/eventForm.js').EventForm, setForm: import('react').Dispatch<import('react').SetStateAction<import('../validation/eventForm.js').EventForm>>, busy: boolean, occurrence: boolean}} props */
export default function EventFields({ form, setForm, busy, occurrence }) {
  /** @param {keyof typeof form} key @param {string} value */
  function text(key,value) { setForm((previous) => ({ ...previous, [key]: value })); }
  /** @param {string} label @param {keyof typeof form} key @param {number} max */
  const field = (label,key,max) => <TextInput accessibilityLabel={label} value={String(form[key] ?? '')} onChangeText={(value) => text(key,value)} maxLength={max} editable={!busy} style={styles.input} placeholder={label} placeholderTextColor={colors.muted} />;
  return <View style={styles.section}>
    <AppText variant="label">Title (required)</AppText>{field('Event title','title',240)}
    <AppText variant="label">Description</AppText><TextInput accessibilityLabel="Event description" value={form.description} onChangeText={(value) => text('description',value)} maxLength={100000} editable={!busy} style={[styles.input,styles.body]} multiline placeholder="Optional details" placeholderTextColor={colors.muted} />
    <AppText variant="label">Location</AppText>{field('Event location','location',500)}
    <View style={styles.row}><AppText variant="label">All day</AppText><Switch accessibilityLabel="All-day event" value={form.allDay} onValueChange={(allDay) => setForm((value) => ({ ...value, allDay }))} disabled={busy} trackColor={{ true: colors.primary }} /></View>
    <AppText variant="label">Start date · YYYY-MM-DD</AppText>{field('Event start date','startDate',10)}
    {!form.allDay && <><AppText variant="label">Start time · HH:mm</AppText>{field('Event start time','startTime',5)}</>}
    <AppText variant="label">{form.allDay ? 'Last day (inclusive)' : 'End date'} · YYYY-MM-DD</AppText>{field('Event end date','endDate',10)}
    {!form.allDay && <><AppText variant="label">End time · HH:mm</AppText>{field('Event end time','endTime',5)}</>}
    {!occurrence && <><AppText variant="heading">Repeat</AppText><CalendarChoices>{['none',...frequencies].map((frequency) => <CalendarChip key={frequency} label={frequency[0].toUpperCase()+frequency.slice(1)} selected={form.frequency === frequency} onPress={() => text('frequency',frequency)} disabled={busy} />)}</CalendarChoices>
      {form.frequency !== 'none' && <><AppText variant="label">Repeat interval</AppText>{field('Repeat interval','interval',3)}
        {form.frequency === 'weekly' && <CalendarChoices>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label,day) => <CalendarChip key={label} label={label} selected={form.weekdays.includes(day)} disabled={busy} onPress={() => setForm((value) => ({ ...value, weekdays: value.weekdays.includes(day) ? value.weekdays.filter((item) => item !== day) : [...value.weekdays,day].sort() }))} />)}</CalendarChoices>}
        <AppText variant="caption" tone="muted">Optional: use an end date OR occurrence limit. Invalid month days and leap dates are skipped.</AppText>
        <AppText variant="label">End date (optional) · YYYY-MM-DD</AppText>{field('Repeat end date','until',10)}
        <AppText variant="label">Occurrence limit (optional)</AppText>{field('Occurrence limit','count',5)}
      </>}
    </>}
  </View>;
}
