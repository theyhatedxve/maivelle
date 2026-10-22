import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
export const taskError = (failure: unknown) =>
  failure instanceof Error ? failure.message : 'Tasks could not be loaded. Try again.';
/** Refresh clock-dependent data while focused and on foreground, without persisting overdue flags. */
function useTaskRefresh(
  refresh: () => void,
  service: ReturnType<typeof useDatabase>['tasksService'],
  cancel?: () => void,
) {
  useFocusEffect(
    useCallback(() => {
      const initial = setTimeout(refresh, 180);
      const interval = setInterval(refresh, 30000);
      const unsubscribe = service.subscribe(refresh);
      const foreground = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        clearTimeout(initial);
        clearInterval(interval);
        unsubscribe();
        foreground.remove();
        cancel?.();
      };
    }, [refresh, service, cancel]),
  );
}
export function useTaskSummary() {
  const { tasksService } = useDatabase();
  const [summary, setSummary] = useState(
    null as {
      incomplete: number;
      today: number;
      overdue: number;
      completed: number;
    } | null,
  );
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(() => {
    const current = ++sequence.current;
    tasksService
      .summary()
      .then((value) => {
        if (current === sequence.current) {
          setSummary(value);
          setError('');
        }
      })
      .catch((failure) => {
        if (current === sequence.current) setError(taskError(failure));
      });
  }, [tasksService]);
  useTaskRefresh(refresh, tasksService);
  useFocusEffect(
    useCallback(
      () => () => {
        sequence.current++;
      },
      [],
    ),
  );
  return { summary, error };
}

export function useTasksList(
  options: import('../../../database/repositories/tasksRepository.ts').TaskQuery,
) {
  const { tasksService } = useDatabase();
  const [tasks, setTasks] = useState([] as Awaited<ReturnType<typeof tasksService.listTasks>>);
  const [categories, setCategories] = useState(
    [] as import('../../../database/repositories/tasksRepository.ts').TaskCategory[],
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(0);
  const busy = useRef(false);
  const { search, categoryId, filter, sort, limit = 50 } = options;
  const load = useCallback(
    async (offset = 0) => {
      if (offset && busy.current) return;
      const request = offset ? requestId.current : ++requestId.current;
      busy.current = true;
      setLoading(true);
      try {
        const [rows, groups] = await Promise.all([
          tasksService.listTasks({ search, categoryId, filter, sort, limit, offset }),
          tasksService.listCategories(),
        ]);
        if (request !== requestId.current) return;
        setTasks((previous) =>
          offset
            ? [...previous, ...rows.filter((row) => !previous.some((task) => task.id === row.id))]
            : rows,
        );
        setCategories(groups);
        setError('');
        setHasMore(rows.length === limit);
      } catch (failure) {
        if (request === requestId.current) {
          setError(taskError(failure));
          setHasMore(false);
        }
      } finally {
        if (request === requestId.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [tasksService, search, categoryId, filter, sort, limit],
  );
  const refresh = useCallback(() => {
    void load();
  }, [load]);
  const cancel = useCallback(() => {
    requestId.current++;
    busy.current = false;
  }, []);
  useTaskRefresh(refresh, tasksService, cancel);
  return {
    tasks,
    categories,
    error,
    loading,
    refresh,
    loadMore: () => {
      if (hasMore && !error) void load(tasks.length);
    },
    tasksService,
  };
}
