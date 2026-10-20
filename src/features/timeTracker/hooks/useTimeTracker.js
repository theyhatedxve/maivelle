import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider';

export const timeError = (/** @type {unknown} */ error) =>
  error instanceof Error
    ? error.message
    : 'Time tracker could not load. Please try again.';
/** @template T @param {() => Promise<T>} loader @param {number} [intervalMs] */
export function useTimeData(loader, intervalMs = 30000) {
  const { timeTrackerService } = useDatabase();
  const [data, setData] = useState(/** @type {T | null} */ (null));
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
        AppState.currentState === 'active'
          ? setInterval(refresh, intervalMs)
          : undefined;
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
    }, [refresh, timeTrackerService, intervalMs])
  );
  return { data, error, loading, refresh };
}
export function useTimeSummary() {
  const { timeTrackerService } = useDatabase();
  const load = useCallback(
    () => timeTrackerService.summary(),
    [timeTrackerService]
  );
  return useTimeData(load);
}
