import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router, usePreventRemove } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider';
import { noteError } from './useNotes';

const blank = { title: '', body: '', categoryId: /** @type {string | null} */ (null) };

/** @param {string | null} id */
export function useNoteEditor(id) {
  const { notesService } = useDatabase();
  const [form, setForm] = useState(blank);
  const [original, setOriginal] = useState(blank);
  const [categories, setCategories] = useState(/** @type {import('../../../database/repositories/noteCategoriesRepository.js').Category[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(original);
  const disablePrevention = usePreventRemove(!leaving && (dirty || saving), ({ repeat }) => {
    if (busy.current) return;
    Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { setLeaving(true); repeat(); } },
    ]);
  });
  useEffect(() => {
    let active = true;
    Promise.all([id === null ? Promise.resolve(null) : /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id) ? notesService.getById(id) : Promise.resolve(null), notesService.categories()])
      .then(([note, groups]) => {
        if (!active) return;
        if (id !== null && !note) setNotFound(true);
        const value = note ? { title: note.title, body: note.body, categoryId: note.categoryId } : blank;
        setForm(value); setOriginal(value); setCategories(groups);
      }).catch((failure) => { if (active) { setError(noteError(failure)); setLoadFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, notesService, attempt]);
  async function save() {
    if (busy.current || loading || loadFailed || notFound) return;
    busy.current = true; setSaving(true); setError('');
    try {
      await notesService.save(id, form);
      setOriginal(form); setLeaving(true);
      disablePrevention();
      router.dismissTo('/notes');
    } catch (failure) { setError(noteError(failure)); }
    finally { busy.current = false; setSaving(false); }
  }
  return { form, setForm, categories, setCategories, loading, loadFailed, notFound, error, setError, saving, save, retry: () => { setLoading(true); setLoadFailed(false); setError(''); setAttempt((value) => value + 1); }, notesService, dirty };
}
