import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import SettingsFrame, { PreferenceToggle, useSettingsAction } from './SettingsFrame.tsx';
import { useSettings } from '../providers/SettingsProvider.tsx';
import { useMedicineNotifications } from '../../../services/notifications/MedicineNotificationsProvider.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useCalendarNotifications } from '../../../services/notifications/CalendarNotificationsProvider.tsx';
export default function NotificationSettings() {
  const { preferences, save } = useSettings();
  const reminders = useMedicineNotifications();
  const calendar = useCalendarNotifications();
  const action = useSettingsAction();
  const [permission, setPermission] = useState('Checking Android permission…');
  useEffect(() => {
    let alive = true;
    async function read() {
      try {
        const native = await import('../../../services/notifications/localNotifications.ts');
        const value = await native.localNotificationAdapter.permissions();
        if (alive)
          setPermission(
            `Notifications ${value.granted ? 'allowed' : 'not allowed'} · exact alarms ${value.exact ? 'allowed' : 'not allowed'}`,
          );
      } catch {
        if (alive)
          setPermission(
            'Android permission status is unavailable. Open Android settings to check.',
          );
      }
    }
    void read();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void read();
    });
    return () => {
      alive = false;
      listener.remove();
    };
  }, [reminders.status]);
  return (
    <SettingsFrame title="Notifications">
      <AppText variant="heading">Calendar reminders</AppText>
      <AppText tone="muted">
        Choose reminders per event in Plan. Private notifications cover the next 30 days, up to 64
        requests. Open Maivelle regularly to refresh them; Android may delay delivery.
      </AppText>
      <AppText>
        Calendar permission:{' '}
        {calendar.status ? (calendar.status.granted ? 'Allowed' : 'Not allowed') : 'Checking…'} ·
        Pending: {calendar.status?.pending ?? 'Checking…'}
      </AppText>
      <AppButton
        label="Request calendar notification permission"
        variant="secondary"
        onPress={() => {
          void calendar.request();
        }}
      />
      <AppButton
        label="Refresh calendar reminders"
        variant="secondary"
        onPress={() => {
          void calendar.refresh();
        }}
      />
      {calendar.error ? <AppText accessibilityRole="alert">{calendar.error}</AppText> : null}
      <AppText variant="heading">Medicine reminders</AppText>
      <AppText>{permission}</AppText>
      <PreferenceToggle
        label="Medicine reminders"
        value={preferences.medicineReminders}
        disabled={action.busy}
        onChange={(value) => {
          void action.run(() => save('medicineReminders', value));
        }}
      />
      <AppText tone="muted">
        Disabling reminders or denying Android permission never deletes medicine schedules or dose
        history. Device notification requests are rebuilt when reminders and permissions are
        enabled. Exact alarms may require separate Android permission.
      </AppText>
      <AppText>Pending local requests: {reminders.status?.pending ?? 'Checking…'}</AppText>
      <AppButton
        label="Request notification permission"
        variant="secondary"
        onPress={() => {
          void action.run(() => reminders.request());
        }}
      />
      <AppButton
        label="Open exact alarm permission"
        variant="secondary"
        onPress={() => {
          void action.run(() => reminders.request(true));
        }}
      />
      <AppButton
        label="Open Android app settings"
        variant="secondary"
        onPress={reminders.settings}
      />
      <AppText accessibilityLiveRegion="polite">{action.message || reminders.error}</AppText>
    </SettingsFrame>
  );
}
