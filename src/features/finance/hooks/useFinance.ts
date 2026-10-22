import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
export const financeError = (error: unknown) =>
  error instanceof Error ? error.message : 'Finance could not load. Please try again.';

export function useFinanceData<T>(loader: () => Promise<T>) {
  const { financeService } = useDatabase();
  const [data, setData] = useState(null as T | null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
          setError(financeError(failure));
          setLoading(false);
        }
      });
  }, [loader]);
  useFocusEffect(
    useCallback(() => {
      const first = setTimeout(refresh, 0);
      const subscription = financeService.subscribe(refresh);
      const foreground = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      const midnightRefresh = setInterval(() => {
        if (AppState.currentState === 'active') refresh();
      }, 60000);
      return () => {
        clearTimeout(first);
        clearInterval(midnightRefresh);
        subscription();
        foreground.remove();
        sequence.current++;
      };
    }, [refresh, financeService]),
  );
  return { data, loading, error, refresh };
}
export function useFinanceSummary() {
  const { financeService } = useDatabase();
  const load = useCallback(() => financeService.report(), [financeService]);
  return useFinanceData(load);
}
/** Mutation guard is synchronous so repeated taps cannot start two saves. */
export function useFinanceAction() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await action();
      after?.();
    } catch (failure) {
      setError(financeError(failure));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return { saving, error, run, busy };
}
