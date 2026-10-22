import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
export const timeError = (error: unknown) =>
  error instanceof Error ? error.message : 'Time tracker could not load. Please try again.';

export function useTimeData<T>(loader: () => Promise<T>, intervalMs: number = 30000) {
  const { timeTrackerService } = useDatabase();
  const [data, setData] = useState(null as T | null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(() => {
    const request = ++sequence.current;
    loader()
      .then((value) => {
        if (request === sequence.current) {
          setData(value);
          setError('');
          setLoading(false);
        }
      })
      .catch((failure) => {
        if (request === sequence.current) {
          setError(timeError(failure));
          setLoading(false);
        }
      });
  }, [loader]);
  useFocusEffect(
    useCallback(() => {
      const first = setTimeout(refresh, 0);
      let interval =
        AppState.currentState === 'active' ? setInterval(refresh, intervalMs) : undefined;
      const foreground = AppState.addEventListener('change', (state) => {
        clearInterval(interval);
        interval = undefined;
        if (state === 'active') {
          refresh();
          interval = setInterval(refresh, intervalMs);
        }
      });
      const unsubscribe = timeTrackerService.subscribe(refresh);
      return () => {
        clearTimeout(first);
        clearInterval(interval);
        foreground.remove();
        unsubscribe();
        sequence.current++;
      };
    }, [refresh, timeTrackerService, intervalMs]),
  );
  return { data, error, loading, refresh };
}
export function useTimeSummary() {
  const { timeTrackerService } = useDatabase();
  const load = useCallback(() => timeTrackerService.summary(), [timeTrackerService]);
  return useTimeData(load);
}
