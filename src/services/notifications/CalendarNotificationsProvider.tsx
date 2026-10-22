import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Linking } from 'react-native';
import { router } from 'expo-router';
import { useDatabase } from '../../database/DatabaseProvider.tsx';
import { registerStoragePause } from '../../database/storage/maintenance.ts';
import {
  addDays,
  localToday,
  validateLocal,
} from '../../features/calendar/services/calendarDates.ts';
import { CALENDAR_OWNER, CALENDAR_WINDOW_DAYS, calendarReminderPlan } from './calendarReminders.ts';

type Status = { granted: boolean; pending: number; limited: boolean };
type State = {
  status: Status | null;
  error: string;
  refresh: () => Promise<void>;
  request: () => Promise<void>;
  settings: () => void;
};
const Context = createContext<State | null>(null);

export default function CalendarNotificationsProvider({ children }: PropsWithChildren) {
  const { calendarService } = useDatabase();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const alive = useRef(false);
  const paused = useRef(false);
  const requesting = useRef(false);
  const serial = useRef(Promise.resolve());
  const refresh = useCallback(() => {
    const task = serial.current.then(async () => {
      if (!alive.current || paused.current) return;
      try {
        const native = await import('./calendarNotifications.native.ts');
        const granted = await native.calendarPermissions();
        const today = localToday();
        const plan = calendarReminderPlan(
          await calendarService.listRange(today, addDays(today, CALENDAR_WINDOW_DAYS)),
          Date.now(),
        );
        const pending = await native.pendingCalendarReminders();
        if (paused.current || !alive.current) return;
        // Keep schedule preferences when permission is denied. Android decides delivery.
        for (const old of pending) {
          const desired = plan.requests.find((item) => item.id === old.identifier);
          if (!desired || old.content.data?.scheduledAt !== desired.at)
            await native.cancelCalendarReminder(old.identifier);
        }
        if (granted) {
          for (const item of plan.requests) {
            if (
              !pending.some(
                (old) => old.identifier === item.id && old.content.data?.scheduledAt === item.at,
              )
            )
              await native.scheduleCalendarReminder(item);
          }
        }
        const count = (await native.pendingCalendarReminders()).length;
        if (alive.current) {
          setStatus({ granted, pending: count, limited: plan.limited });
          setError('');
        }
      } catch {
        if (alive.current)
          setError(
            'Calendar reminder scheduling failed. Events remain saved. Retry in Plan or check Android notification settings.',
          );
      }
    });
    serial.current = task;
    return task;
  }, [calendarService]);
  useEffect(() => {
    alive.current = true;
    paused.current = false;
    void refresh();
    const changes = calendarService.subscribe(() => {
      void refresh();
    });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 60000);
    const pause = registerStoragePause(async () => {
      paused.current = true;
      await serial.current;
      const native = await import('./calendarNotifications.native.ts');
      for (const old of await native.pendingCalendarReminders())
        await native.cancelCalendarReminder(old.identifier);
    });
    let taps: { remove: () => void } | undefined;
    import('expo-notifications')
      .then((native) => {
        if (!alive.current) return;
        const redirect = (response: import('expo-notifications').NotificationResponse) => {
          const data = response.notification.request.content.data;
          if (
            data?.owner !== CALENDAR_OWNER ||
            typeof data.eventId !== 'string' ||
            !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(data.eventId) ||
            typeof data.occurrenceStart !== 'string'
          )
            return;
          try {
            validateLocal(data.occurrenceStart, false);
          } catch {
            return;
          }
          // Resolve current state before navigating: a delivered event may have been deleted.
          void calendarService
            .getEventById(data.eventId)
            .then((event) => {
              if (!event || !alive.current) return;
              router.push({
                pathname: '/event/[id]',
                params: {
                  id: event.id,
                  ...(event.recurrence ? { occurrence: data.occurrenceStart as string } : {}),
                },
              });
              native.clearLastNotificationResponse();
            })
            .catch(() => {
              if (alive.current) setError('Could not open the reminder. Open Plan and retry.');
            });
        };
        const last = native.getLastNotificationResponse();
        if (last) redirect(last);
        taps = native.addNotificationResponseReceivedListener(redirect);
      })
      .catch(() => {
        if (alive.current) setError('Calendar notifications are unavailable in this runtime.');
      });
    return () => {
      alive.current = false;
      paused.current = true;
      changes();
      foreground.remove();
      clearInterval(interval);
      pause();
      taps?.remove();
    };
  }, [calendarService, refresh]);
  const request = useCallback(async () => {
    if (requesting.current) return;
    requesting.current = true;
    try {
      const native = await import('./calendarNotifications.native.ts');
      await native.calendarPermissions(true);
      await refresh();
    } catch {
      setError('Could not request notification permission. Open Android app settings.');
    } finally {
      requesting.current = false;
    }
  }, [refresh]);
  return (
    <Context.Provider
      value={{
        status,
        error,
        refresh,
        request,
        settings: () => {
          void Linking.openSettings().catch(() =>
            setError('Open Android App info for Maivelle manually.'),
          );
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCalendarNotifications() {
  const state = useContext(Context);
  if (!state) throw new Error('Calendar notifications provider is unavailable.');
  return state;
}
