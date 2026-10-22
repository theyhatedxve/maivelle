import { useEffect, useRef, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { router, useFocusEffect, usePreventRemove } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { taskError } from './useTasks.ts';
const blank = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  dueDate: null,
  dueTime: null,
  categoryId: null,
} as import('../validation/taskInput.ts').TaskInput;

export function useTaskEditor(id: string | null, externalDirty: boolean) {
  const { tasksService } = useDatabase();
  const [form, setForm] = useState(blank);
  const [original, setOriginal] = useState(blank);
  const [task, setTask] = useState(null as Awaited<ReturnType<typeof tasksService.getTaskById>>);
  const [categories, setCategories] = useState(
    [] as import('../../../database/repositories/tasksRepository.ts').TaskCategory[],
  );
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(original) || externalDirty;
  const disablePrevention = usePreventRemove(!leaving && (dirty || saving), ({ repeat }) => {
    if (lock.current) return;
    Alert.alert(
      'Discard task changes?',
      'Unsaved task and checklist drafts will be lost. Checklist changes already saved remain on this device.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setLeaving(true);
            repeat();
          },
        },
      ],
    );
  });
  useEffect(() => {
    let active = true;
    Promise.all([
      id === null
        ? Promise.resolve(null)
        : /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)
          ? tasksService.getTaskById(id)
          : Promise.resolve(null),
      tasksService.listCategories(),
    ])
      .then(([record, groups]) => {
        if (!active) return;
        if (id !== null && !record) setNotFound(true);
        const value = record
          ? {
              title: record.title,
              description: record.description,
              priority: record.priority,
              status: record.status,
              dueDate: record.dueDate,
              dueTime: record.dueTime,
              categoryId: record.categoryId,
            }
          : blank;
        setTask(record);
        setForm(value);
        setOriginal(value);
        setCategories(groups);
      })
      .catch((failure) => {
        if (active) {
          setError(taskError(failure));
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, tasksService, attempt]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      tasksService
        .listCategories()
        .then((value) => {
          if (active) setCategories(value);
        })
        .catch((failure) => {
          if (active) setError(taskError(failure));
        });
      return () => {
        active = false;
      };
    }, [tasksService]),
  );
  async function save() {
    if (lock.current || loading || loadFailed || notFound || externalDirty) return;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      if (id === null) await tasksService.createTask(form);
      else await tasksService.updateTask(id, form);
      setOriginal(form);
      setLeaving(true);
      disablePrevention();
      router.dismissTo('/tasks');
    } catch (failure) {
      setError(taskError(failure));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return {
    form,
    setForm,
    task,
    categories,
    error,
    loading,
    loadFailed,
    notFound,
    saving,
    dirty,
    save,
    retry: () => {
      setLoading(true);
      setLoadFailed(false);
      setError('');
      setAttempt((value) => value + 1);
    },
  };
}
