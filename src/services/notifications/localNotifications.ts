import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { MEDICINE_OWNER } from './medicineReconciler.ts';
export const MEDICINE_CHANNEL = 'maivelle-medicine';
let presentMedicine = true;
export function setMedicinePresentation(enabled: boolean) {
  presentMedicine = enabled;
}
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const show = notification.request.content.data?.owner !== MEDICINE_OWNER || presentMedicine;
    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show,
      shouldSetBadge: false,
    };
  },
});
export async function ensureMedicineChannel() {
  // Omitting channel.sound selects Android's default. SDK 58 treats the string
  // 'default' here as a custom filename and emits a missing-resource warning.
  await Notifications.setNotificationChannelAsync(MEDICINE_CHANNEL, {
    name: 'Medication reminders',
    description: 'Private local reminders to open Maivelle',
    importance: AndroidImportance.HIGH,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    vibrationPattern: [0, 250, 250, 250],
  });
}
export const localNotificationAdapter = {
  async permissions() {
    await ensureMedicineChannel();
    const [notification, exact] = await Promise.all([
      Notifications.getPermissionsAsync(),
      Notifications.getExactAlarmPermissionsAsync(),
    ]);
    const channel = await Notifications.getNotificationChannelAsync(MEDICINE_CHANNEL);
    return {
      granted: notification.granted && channel?.importance !== AndroidImportance.NONE,
      exact: exact.granted,
    };
  },
  async pending() {
    return (await Notifications.getAllScheduledNotificationsAsync()).map((item) => ({
      id: item.identifier,
      owner: item.content.data?.owner,
      occurrenceId: item.content.data?.occurrenceId,
      scheduledAt: item.content.data?.scheduledAt,
      delivery: item.content.data?.delivery,
    }));
  },
  async cancel(id: string) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },

  async schedule(
    dose: import('../../features/medicine/services/doseOccurrences.ts').Dose,
    id: string,
    delivery: 'alarmClock' | 'bestEffort',
  ) {
    return Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: 'Maivelle reminder',
        body: 'Open Maivelle to review your scheduled reminder.',
        sound: 'default',
        data: {
          owner: MEDICINE_OWNER,
          occurrenceId: dose.id,
          medicineId: dose.medicineId,
          scheduledAt: dose.scheduledAt,
          delivery,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(dose.scheduledAt),
        channelId: MEDICINE_CHANNEL,
        delivery,
      },
    });
  },
};
export async function requestMedicineNotifications() {
  await ensureMedicineChannel();
  return Notifications.requestPermissionsAsync();
}
export async function requestMedicineExactAlarms() {
  return Notifications.requestExactAlarmPermissionsAsync();
}
