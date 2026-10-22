import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router, usePreventRemove } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { DatabaseError } from '../../../database/errors.ts';
import { blankEventForm, eventToForm, formToEvent, formToRule } from '../validation/eventForm.ts';
import { calendarError } from './useCalendar.ts';

export function useEventEditor(
  id: string | null,
  occurrence: string | null,
  date: string,
  externalDirty: boolean,
) {
  const { calendarService } = useDatabase();
  const [form, setForm] = useState(() => blankEventForm(date));
  const [original, setOriginal] = useState(() => blankEventForm(date));
  const [event, setEvent] = useState(
    null as import('../../../database/repositories/calendarRepository.ts').CalendarEvent | null,
  );
  const [categories, setCategories] = useState(
    [] as import('../../../database/repositories/calendarRepository.ts').CalendarCategory[],
  );
  const [exceptions, setExceptions] = useState(
    [] as import('../../../database/repositories/calendarRepository.ts').CalendarException[],
  );
  const [cancelled, setCancelled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(original) || externalDirty;
  const disablePrevention = usePreventRemove(!leaving && (dirty || busy), ({ repeat }) => {
    if (lock.current) return;
    Alert.alert(
      'Discard event changes?',
      'Unsaved drafts will be lost. Already saved category/exception changes remain.',
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
    (async () => {
      const groups = await calendarService.listCategories();
      const parent =
        id === null
          ? null
          : /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)
            ? await calendarService.getEventById(id)
            : null;
      const record =
        parent && occurrence ? await calendarService.getOccurrence(parent.id, occurrence) : parent;
      const overrides = parent ? await calendarService.listExceptions(parent.id) : [];
      if (!active) return;
      if (id !== null && !parent) setNotFound(true);
      const value = record ? eventToForm(record) : blankEventForm(date);
      setForm(value);
      setOriginal(value);
      setEvent(parent);
      setCategories(groups);
      setExceptions(overrides);
      setCancelled(!!(record && 'cancelled' in record && record.cancelled));
    })()
      .catch((failure) => {
        if (active) {
          if (
            failure instanceof DatabaseError &&
            ['NOT_FOUND', 'VALIDATION'].includes(failure.code)
          )
            setNotFound(true);
          else {
            setError(calendarError(failure));
            setLoadFailed(true);
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, occurrence, date, calendarService, attempt]);
  async function perform(operation: () => Promise<unknown>, leave = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
      if (leave) {
        setLeaving(true);
        disablePrevention();
        router.dismissTo('/calendar');
      } else if (id) setExceptions(await calendarService.listExceptions(id));
    } catch (failure) {
      setError(calendarError(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (loading || loadFailed || notFound || externalDirty) return;
    await perform(async () => {
      const input = formToEvent(form);
      if (!id) await calendarService.createEvent(input, formToRule(form));
      else if (occurrence) await calendarService.updateOccurrence(id, occurrence, input);
      else await calendarService.updateEvent(id, input, formToRule(form));
      setOriginal(form);
    }, true);
  }
  return {
    form,
    setForm,
    event,
    categories,
    setCategories,
    exceptions,
    cancelled,
    loading,
    loadFailed,
    notFound,
    error,
    setError,
    busy,
    dirty,
    save,
    perform,
    calendarService,
    retry: () => {
      setLoading(true);
      setLoadFailed(false);
      setNotFound(false);
      setError('');
      setAttempt((value) => value + 1);
    },
  };
}
