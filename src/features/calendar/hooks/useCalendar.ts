import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { addDays, localToday } from '../services/calendarDates.ts';
export const calendarError = (error: unknown) =>
  error instanceof Error ? error.message : 'Calendar could not load. Please try again.';

export function useCalendarRange(from: string, to: string, search: string = '') {
  const { calendarService, tasksService } = useDatabase();
  const [entries, setEntries] = useState(
    [] as import('../services/calendarService.ts').CalendarEntry[],
  );
  const [categories, setCategories] = useState(
    [] as import('../../../database/repositories/calendarRepository.ts').CalendarCategory[],
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const refresh = useCallback(() => {
    const request = ++version.current;
    setLoading(true);
    calendarService
      .listRange(from, to, search)
      .then(async (data) => ({ data, groups: await calendarService.listCategories() }))
      .then(({ data, groups }) => {
        if (request === version.current) {
          setEntries(data);
          setCategories(groups);
          setError('');
        }
      })
      .catch((failure) => {
        if (request === version.current) {
          setError(calendarError(failure));
          setEntries([]);
        }
      })
      .finally(() => {
        if (request === version.current) setLoading(false);
      });
  }, [calendarService, from, to, search]);
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(refresh, 180);
      const interval = setInterval(refresh, 30000);
      const calendar = calendarService.subscribe(refresh);
      const tasks = tasksService.subscribe(refresh);
      const foreground = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
        calendar();
        tasks();
        foreground.remove();
        version.current++;
      };
    }, [refresh, calendarService, tasksService]),
  );
  return { entries, categories, error, loading, refresh };
}
export function useUpcomingEvents() {
  const today = localToday();
  const query = useCalendarRange(today, addDays(today, 30));
  const now = new Date();
  const localNow = `${today}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return {
    ...query,
    events: query.entries.filter((entry) => entry.type === 'event' && entry.endLocal > localNow),
  };
}
