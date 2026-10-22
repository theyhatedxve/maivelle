import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router, usePreventRemove } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { medicineError } from './useMedicine.ts';
export type ScheduleForm = {
  weekdays: number[];
  timesText: string;
  startDate: string;
  endDate: string;
};
export type MedicineForm = {
  name: string;
  form: string;
  instructions: string;
  notes: string;
  active: boolean;
  startDate: string;
  endDate: string;
  schedules: ScheduleForm[];
};

export const blankSchedule = (): ScheduleForm => ({
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  timesText: '',
  startDate: '',
  endDate: '',
});

const blank: MedicineForm = {
  name: '',
  form: '',
  instructions: '',
  notes: '',
  active: true,
  startDate: '',
  endDate: '',
  schedules: [blankSchedule()],
};

export function useMedicineEditor(id: string | null) {
  const { medicineService } = useDatabase();
  const [form, setForm] = useState(blank);
  const [original, setOriginal] = useState(blank);
  const [revision, setRevision] = useState(null as number | null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(original);
  const allow = usePreventRemove(!leaving && (dirty || saving), ({ repeat }) => {
    if (lock.current) return;
    Alert.alert('Discard medicine changes?', 'Unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setLeaving(true);
          repeat();
        },
      },
    ]);
  });
  useEffect(() => {
    let active = true;
    (id === null
      ? Promise.resolve(null)
      : /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)
        ? medicineService.get(id)
        : Promise.resolve(null)
    )
      .then((medicine) => {
        if (!active) return;
        if (id && !medicine) setNotFound(true);
        const value = medicine
          ? {
              name: medicine.name,
              form: medicine.form,
              instructions: medicine.instructions,
              notes: medicine.notes,
              active: medicine.active,
              startDate: medicine.startDate ?? '',
              endDate: medicine.endDate ?? '',
              schedules: medicine.schedules.map((schedule) => ({
                weekdays: schedule.weekdays,
                timesText: schedule.times.join(', '),
                startDate: schedule.startDate ?? '',
                endDate: schedule.endDate ?? '',
              })),
            }
          : blank;
        setForm(value);
        setOriginal(value);
        setRevision(medicine?.revision ?? null);
      })
      .catch((failure) => {
        if (active) {
          setFailed(true);
          setError(medicineError(failure));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, id, medicineService]);
  async function save() {
    if (lock.current || loading || failed || notFound) return;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await medicineService.save(
        id,
        {
          ...form,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          schedules: form.schedules.map((schedule) => ({
            weekdays: schedule.weekdays,
            times: schedule.timesText.split(',').map((time) => time.trim()),
            startDate: schedule.startDate || null,
            endDate: schedule.endDate || null,
          })),
        },
        revision,
      );
      setOriginal(form);
      setLeaving(true);
      allow();
      router.dismissTo({ pathname: '/medicine/[id]', params: { id: result.id } });
    } catch (failure) {
      setError(medicineError(failure));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return {
    form,
    setForm,
    loading,
    failed,
    notFound,
    error,
    saving,
    save,
    retry: () => {
      setLoading(true);
      setFailed(false);
      setNotFound(false);
      setError('');
      setAttempt((value) => value + 1);
    },
  };
}
