import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FileText, Plus } from 'lucide-react-native';
import AppHeader from '../../../components/layout/AppHeader';
import AppButton from '../../../components/ui/AppButton';
import EmptyState from '../../../components/ui/EmptyState';
import { colors, spacing } from '../../../theme';
import { useNotesLibrary, noteError } from '../hooks/useNotes';
import NoteListItem from './NoteListItem';
import { CategoryPicker, NoteChip, NotesError, StorageNotice } from './NotesControls';
import { notesStyles as styles } from './notesStyles';

export default function NotesLibrary() {
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [categoryId, setCategoryId] = useState(/** @type {string | null | undefined} */ (undefined));
  const { notes, categories, loading, error, refresh, loadMore, notesService } = useNotesLibrary({ search, archived, categoryId });
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const lock = useRef(false);
  const perform = useCallback(async (/** @type {string} */ id, /** @type {() => Promise<unknown>} */ action) => {
    if (lock.current) return;
    lock.current = true; setBusyId(id); setActionError('');
    try { await action(); } catch (failure) { setActionError(noteError(failure)); }
    finally { lock.current = false; setBusyId(''); }
  }, []);
  const renderItem = useCallback((/** @type {{item: import('../../../database/types.js').Note}} */ { item }) => <NoteListItem
    note={item} category={categories.find((group) => group.id === item.categoryId)?.name ?? 'Uncategorized'} busy={!!busyId}
    onOpen={() => router.push({ pathname: '/notes/[id]', params: { id: item.id } })}
    onPin={() => { void perform(item.id, () => notesService.setFlag(item.id, 'pinned', !item.pinned)); }}
    onArchive={() => { void perform(item.id, () => notesService.setFlag(item.id, 'archived', !item.archived)); }}
    onDelete={() => Alert.alert('Delete note?', 'This permanently deletes the note from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void perform(item.id, () => notesService.remove(item.id, true)); } },
    ])} />, [categories, busyId, perform, notesService]);
  return <SafeAreaView style={styles.safe}>
    <FlatList data={notes} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onEndReached={loadMore} onEndReachedThreshold={0.3}
      refreshing={loading && notes.length > 0} onRefresh={() => { void refresh(); }} initialNumToRender={8} windowSize={7}
      ItemSeparatorComponent={() => <View style={{ height: spacing.xl }} />}
      ListHeaderComponent={<View style={styles.section}>
        <AppHeader title="Notes" subtitle="Your ideas, kept on this device" back />
        <StorageNotice />
        <TextInput accessibilityLabel="Search notes" placeholder="Search title and content" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.input} maxLength={1000} returnKeyType="search" />
        <View style={styles.row}><NoteChip label="Active" selected={!archived} onPress={() => setArchived(false)} /><NoteChip label="Archived" selected={archived} onPress={() => setArchived(true)} /></View>
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} filter />
        {error && <NotesError message={error} onRetry={() => { void refresh(); }} />}
        {actionError && <NotesError message={actionError} />}
      </View>}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading notes" /> : !error ? <EmptyState icon={FileText} title={search || categoryId !== undefined ? 'No matching notes' : archived ? 'No archived notes' : 'Your notes start here'} description={search || categoryId !== undefined ? 'Try another search or category.' : 'Create a nonsensitive test note to get started.'} /> : undefined}
      ListFooterComponent={loading && notes.length > 0 ? <ActivityIndicator color={colors.primary} /> : undefined} />
    <View style={styles.fab}><AppButton label="Create note" icon={Plus} onPress={() => router.push('/notes/new')} /></View>
  </SafeAreaView>;
}
