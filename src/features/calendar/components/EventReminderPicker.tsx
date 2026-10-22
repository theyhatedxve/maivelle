import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Check, ChevronDown } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useCalendarNotifications } from '../../../services/notifications/CalendarNotificationsProvider.tsx';
import { usePlanStyles } from './planStyles.ts';

const options = [
  { value: null, label: 'No reminder' },
  { value: 0, label: 'At start time' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];
export default function EventReminderPicker({
  value,
  onChange,
  disabled,
  allDay,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled: boolean;
  allDay: boolean;
}) {
  const [open, setOpen] = useState(false);
  const styles = usePlanStyles();
  const { colors } = useTheme();
  const reminders = useCalendarNotifications();
  return (
    <View style={styles.formGroup}>
      <AppText variant="label">Reminder</AppText>
      <Pressable
        style={styles.fieldRow}
        accessibilityRole="button"
        accessibilityLabel={`Reminder: ${options.find((item) => item.value === value)?.label}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <View style={styles.fieldIcon}>
          <Bell size={19} color={colors.primary} accessible={false} />
        </View>
        <AppText style={styles.dateValue}>
          {options.find((item) => item.value === value)?.label}
        </AppText>
        <ChevronDown size={16} color={colors.muted} accessible={false} />
      </Pressable>
      {value !== null ? (
        <>
          <AppText variant="caption" tone="muted">
            Private local notification, scheduled after saving.{' '}
            {allDay ? 'All-day reminders are relative to midnight. ' : ''}Android may delay
            delivery. The next 30 days are refreshed when Maivelle opens.
          </AppText>
          {reminders.status && !reminders.status.granted ? (
            <AppButton
              label="Allow calendar notifications"
              variant="secondary"
              onPress={() => {
                void reminders.request();
              }}
            />
          ) : null}
          {reminders.status && !reminders.status.granted ? (
            <AppButton
              label="Open Android notification settings"
              variant="secondary"
              onPress={reminders.settings}
            />
          ) : null}
        </>
      ) : null}
      {reminders.error ? <AppText accessibilityRole="alert">{reminders.error}</AppText> : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <AppText variant="heading">Event reminder</AppText>
            <ScrollView contentContainerStyle={styles.section}>
              {options.map((item) => (
                <Pressable
                  key={String(item.value)}
                  style={styles.fieldRow}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: item.value === value }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <AppText style={styles.dateValue}>{item.label}</AppText>
                  {item.value === value ? (
                    <Check size={20} color={colors.primary} accessible={false} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <AppButton label="Cancel" variant="secondary" onPress={() => setOpen(false)} />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
