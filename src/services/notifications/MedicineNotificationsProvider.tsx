import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { router } from 'expo-router';
import { useSettings } from '../../features/settings/providers/SettingsProvider.tsx';
import { registerStoragePause } from '../../database/storage/maintenance.ts';
import { useDatabase } from '../../database/DatabaseProvider.tsx';
import { addDays, localToday } from '../../features/calendar/services/calendarDates.ts';
import {
  createMedicineReconciler,
  MEDICINE_OWNER,
  REMINDER_WINDOW_DAYS,
} from './medicineReconciler.ts';

export type MedicineNotificationsProviderProps = {
  children: import('react').ReactNode;
};

export type ReminderStatus = {
  granted: boolean;
  exact: boolean;
  pending: number;
  limited: boolean;
  horizon: number;
};
export type NotificationContextValue = {
  status: ReminderStatus | null;
  error: string;
  refresh: () => Promise<void>;
  request: (exact?: boolean) => Promise<void>;
  settings: () => void;
};

const Context = createContext(null as NotificationContextValue | null);

export default function MedicineNotificationsProvider({
  children,
}: MedicineNotificationsProviderProps) {
  const { medicineService, medicineRepository } = useDatabase();
  const { preferences } = useSettings();
  const enabled = useRef(preferences.medicineReminders);
  useEffect(() => {
    enabled.current = preferences.medicineReminders;
  }, [preferences.medicineReminders]);
  const paused = useRef(false);
  const [status, setStatus] = useState(null as ReminderStatus | null);
  const [error, setError] = useState('');
  const infrastructure = useRef(null as Promise<typeof import('./localNotifications.ts')> | null);
  const engine = useRef(null as ReturnType<typeof createMedicineReconciler> | null);
  const alive = useRef(true);
  const serial = useRef(Promise.resolve());
  const load = useCallback(
    () => (infrastructure.current ??= import('./localNotifications.ts')),
    [],
  );
  const refresh = useCallback(
    (rearm = true) => {
      const task = serial.current.then(async () => {
        try {
          if (paused.current || !alive.current) return;
          const native = await load();
          native.setMedicinePresentation(enabled.current);
          engine.current ??= createMedicineReconciler(medicineRepository, {
            ...native.localNotificationAdapter,
            permissions: async () => {
              const permission = await native.localNotificationAdapter.permissions();
              return { ...permission, granted: permission.granted && enabled.current };
            },
          });
          const now = new Date();
          const today = localToday(now);
          const doses = await medicineService.doses(today, addDays(today, REMINDER_WINDOW_DAYS));
          const result = await engine.current.reconcile(doses, now, { rearm });
          if (alive.current) {
            setStatus(result);
            setError('');
          }
        } catch {
          if (alive.current)
            setError(
              'Local reminders could not reconcile. Open Medicine to retry. A native rebuild may be required. Dose records remain available.',
            );
        }
      });
      serial.current = task;
      return task;
    },
    [load, medicineRepository, medicineService],
  );
  useEffect(() => {
    alive.current = true;
    paused.current = false;
    void refresh();
    const unregisterPause = registerStoragePause(async () => {
      paused.current = true;
      await serial.current;
    });
    const changes = medicineService.subscribe(() => {
      void refresh();
    });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh(false);
    }, 60000);
    let taps:
      | {
          remove: () => void;
        }
      | undefined;
    // Import failure is displayed through refresh, rather than breaking database navigation.
    load()
      .then(async () => {
        const notifications = await import('expo-notifications');
        if (!alive.current) return;
        const redirect = (response: import('expo-notifications').NotificationResponse) => {
          const data = response.notification.request.content.data;
          if (
            data?.owner === MEDICINE_OWNER &&
            typeof data.medicineId === 'string' &&
            /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(data.medicineId)
          ) {
            router.push({ pathname: '/medicine/[id]', params: { id: data.medicineId } });
            notifications.clearLastNotificationResponse();
          }
        };
        const last = notifications.getLastNotificationResponse();
        if (last) redirect(last);
        taps = notifications.addNotificationResponseReceivedListener(redirect);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
      paused.current = true;
      unregisterPause();
      changes();
      foreground.remove();
      clearInterval(timer);
      taps?.remove();
    };
  }, [load, medicineService, refresh]);
  useEffect(() => {
    void refresh();
  }, [preferences.medicineReminders, refresh]);
  const request = useCallback(
    async (exact = false) => {
      try {
        const native = await load();
        if (exact) await native.requestMedicineExactAlarms();
        else await native.requestMedicineNotifications();
        await refresh();
      } catch {
        setError(
          'Could not open reminder permission settings. Check Android App info → Notifications and Alarms & reminders.',
        );
      }
    },
    [load, refresh],
  );
  return (
    <Context.Provider
      value={{
        status,
        error,
        refresh,
        request,
        settings: () => {
          Linking.openSettings().catch(() =>
            setError('Open Android App info for Maivelle manually.'),
          );
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useMedicineNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error('Reminder provider is unavailable.');
  return context;
}
