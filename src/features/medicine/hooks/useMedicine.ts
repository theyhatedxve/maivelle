import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
export const medicineError = (error: unknown) =>
  error instanceof Error ? error.message : 'Medicine could not load. Please retry.';

export function useMedicineQuery<T>(loader: () => Promise<T>) {
  const { medicineService } = useDatabase();
  const [data, setData] = useState(null as T | null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const refresh = useCallback(() => {
    const request = ++version.current;
    return loader()
      .then((value) => {
        if (request === version.current) {
          setData(value);
          setError('');
        }
      })
      .catch((failure) => {
        if (request === version.current) {
          setError(medicineError(failure));
          setData(null);
        }
      })
      .finally(() => {
        if (request === version.current) setLoading(false);
      });
  }, [loader]);
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      const timer = setTimeout(() => {
        void refresh();
      }, 150);
      const interval = setInterval(() => {
        void refresh();
      }, 30000);
      const unsubscribe = medicineService.subscribe(() => {
        void refresh();
      });
      const foreground = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
        unsubscribe();
        foreground.remove();
        version.current++;
      };
    }, [medicineService, refresh]),
  );
  return { data, error, loading, refresh };
}
export function useMedicineSummary() {
  const { medicineService } = useDatabase();
  return useMedicineQuery(useCallback(() => medicineService.summary(), [medicineService]));
}
