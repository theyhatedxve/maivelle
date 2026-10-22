import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { observeNotesCount } from './observeNotesCount.ts';
export const noteError = (error: unknown) =>
  error instanceof Error ? error.message : 'Notes could not be loaded. Please try again.';
/** Shared focus/subscription lifecycle also refreshes the dashboard after native Back. */
export function useNotesCount() {
  const { notesService } = useDatabase();
  const [count, setCount] = useState(null as number | null);
  const [error, setError] = useState('');
  useFocusEffect(
    useCallback(() => {
      return observeNotesCount(
        notesService,
        (value) => {
          setCount(value);
          setError('');
        },
        (failure) => setError(noteError(failure)),
      );
    }, [notesService]),
  );
  return { count, error };
}

export function useNotesLibrary(filters: {
  search: string;
  archived: boolean;
  categoryId?: string | null;
}) {
  const { notesService } = useDatabase();
  const [notes, setNotes] = useState([] as import('../../../database/types.ts').Note[]);
  const [categories, setCategories] = useState(
    [] as import('../../../database/repositories/noteCategoriesRepository.ts').Category[],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const generation = useRef(0);
  const busy = useRef(false);
  const { search, archived, categoryId } = filters;
  const load = useCallback(
    async (offset = 0) => {
      if (offset && busy.current) return;
      const request = offset ? generation.current : ++generation.current;
      busy.current = true;
      setLoading(true);
      setError('');
      try {
        const [rows, groups] = await Promise.all([
          notesService.listLibrary({
            search,
            archived,
            categoryId,
            limit: 50,
            offset,
          }),
          notesService.categories(),
        ]);
        if (request !== generation.current) return;
        setNotes((previous) =>
          offset
            ? [...previous, ...rows.filter((row) => !previous.some((note) => note.id === row.id))]
            : rows,
        );
        setCategories(groups);
        setHasMore(rows.length === 50);
      } catch (failure) {
        if (request === generation.current) {
          setError(noteError(failure));
          setHasMore(false);
        }
      } finally {
        if (request === generation.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [notesService, search, archived, categoryId],
  );
  useFocusEffect(
    useCallback(() => {
      setNotes([]);
      setLoading(true);
      const timer = setTimeout(() => {
        void load();
      }, 180);
      const unsubscribe = notesService.subscribe(() => {
        void load();
      });
      return () => {
        clearTimeout(timer);
        unsubscribe();
        generation.current++;
        busy.current = false;
      };
    }, [load, notesService]),
  );
  return {
    notes,
    categories,
    loading,
    error,
    refresh: () => load(),
    loadMore: () => {
      if (hasMore && !error) void load(notes.length);
    },
    notesService,
  };
}
