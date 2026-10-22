import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { useVault } from '../../vault/providers/VaultProvider.tsx';
import type { Note } from '../../../database/types.ts';

export function useDashboardClock() {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      const refresh = () => setNow(new Date());
      const initial = setTimeout(refresh, 0);
      const timer = setInterval(refresh, 60_000);
      const foreground = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        clearTimeout(initial);
        clearInterval(timer);
        foreground.remove();
      };
    }, []),
  );
  return now;
}

/** Bounded previews and an encrypted-row count; never decrypts Vault credentials. */
export function useDashboardExtras() {
  const { notesService, vaultRepository } = useDatabase();
  const { service: vault } = useVault();
  const [notes, setNotes] = useState<Note[]>([]);
  const [vaultCount, setVaultCount] = useState<number | null>(null);
  const [notesError, setNotesError] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let noteRequest = 0;
      let vaultRequest = 0;
      const loadNotes = () => {
        const request = ++noteRequest;
        void notesService
          .listLibrary({ archived: false, sort: 'recent', limit: 3, offset: 0 })
          .then((rows) => {
            if (active && request === noteRequest) {
              setNotes(rows);
              setNotesError('');
              setLoadingNotes(false);
            }
          })
          .catch(() => {
            if (active && request === noteRequest) {
              setNotesError('Recent notes could not load. Open Notes to retry.');
              setLoadingNotes(false);
            }
          });
      };
      const loadVault = () => {
        const request = ++vaultRequest;
        void vaultRepository
          .countItems()
          .then((count) => {
            if (active && request === vaultRequest) {
              setVaultCount(count);
              setVaultError('');
            }
          })
          .catch(() => {
            if (active && request === vaultRequest) setVaultError('Vault count unavailable.');
          });
      };
      const initial = setTimeout(() => {
        loadNotes();
        loadVault();
      }, 0);
      const notesSubscription = notesService.subscribe(loadNotes);
      const vaultSubscription = vault.subscribe(loadVault);
      const foreground = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          loadNotes();
          loadVault();
        }
      });
      return () => {
        active = false;
        clearTimeout(initial);
        notesSubscription();
        vaultSubscription();
        foreground.remove();
      };
    }, [notesService, vaultRepository, vault]),
  );
  return { notes, vaultCount, notesError, vaultError, loadingNotes };
}
