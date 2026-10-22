import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { CALENDAR_OWNER, type CalendarReminder } from './calendarReminders.ts';

const CHANNEL = 'maivelle-calendar';
export async function calendarPermissions(request = false) {
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Calendar reminders',
    description: 'Private local event reminders',
    importance: AndroidImportance.DEFAULT,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
  const permission = await (request
    ? Notifications.requestPermissionsAsync()
    : Notifications.getPermissionsAsync());
  const channel = await Notifications.getNotificationChannelAsync(CHANNEL);
  return permission.granted && channel?.importance !== AndroidImportance.NONE;
}
export async function pendingCalendarReminders() {
  return (await Notifications.getAllScheduledNotificationsAsync()).filter(
    (item) => item.content.data?.owner === CALENDAR_OWNER,
  );
}
export async function cancelCalendarReminder(id: string) {
  await Notifications.cancelScheduledNotificationAsync(id);
}
export async function scheduleCalendarReminder(item: CalendarReminder) {
  await Notifications.scheduleNotificationAsync({
    identifier: item.id,
    content: {
      title: 'Maivelle calendar reminder',
      body: 'Open Maivelle to review your upcoming event.',
      sound: 'default',
      data: {
        owner: CALENDAR_OWNER,
        eventId: item.eventId,
        occurrenceStart: item.occurrenceStart,
        scheduledAt: item.at,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(item.at),
      channelId: CHANNEL,
      delivery: 'bestEffort',
    },
  });
}
