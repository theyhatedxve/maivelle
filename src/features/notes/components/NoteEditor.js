import { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { FileQuestion, Save } from 'lucide-react-native';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import AppText from '../../../components/ui/AppText';
import AppButton from '../../../components/ui/AppButton';
import EmptyState from '../../../components/ui/EmptyState';
import { colors } from '../../../theme';
import { useNoteEditor } from '../hooks/useNoteEditor';
import { noteError } from '../hooks/useNotes';
import { CategoryPicker, NotesError, StorageNotice } from './NotesControls';
import { notesStyles as styles } from './notesStyles';

/** @param {{id: string | null}} props */
export default function NoteEditor({ id }) {
  const editor = useNoteEditor(id);
  const { form, setForm, loading, notFound, error, saving } = editor;
  const [categoryName, setCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const categoryLock = useRef(false);
  async function addCategory() {
    if (categoryLock.current) return;
    categoryLock.current = true; setAddingCategory(true); editor.setError('');
    try {
      const category = await editor.notesService.createCategory(categoryName);
      editor.setCategories(await editor.notesService.categories());
      setForm((value) => ({ ...value, categoryId: category.id })); setCategoryName(''); Keyboard.dismiss();
    } catch (failure) { editor.setError(noteError(failure)); }
    finally { categoryLock.current = false; setAddingCategory(false); }
  }
  return <ScreenContainer><AppHeader title={id === null ? 'Create note' : 'Edit note'} subtitle={editor.dirty ? 'Unsaved changes' : 'Stored on this device'} back />
    {loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading note" /> : editor.loadFailed ? <NotesError message={error} onRetry={editor.retry} /> : notFound ? <EmptyState icon={FileQuestion} title="Note not found" description="This ID is invalid or the note has been deleted." action={<AppButton label="Back to Notes" onPress={() => router.dismissTo('/notes')} />} /> : <View style={styles.section}>
      <StorageNotice />
      {error && <NotesError message={error} onRetry={editor.categories.length === 0 && !editor.dirty ? editor.retry : undefined} />}
      <AppText variant="label">Title</AppText>
      <TextInput accessibilityLabel="Note title" placeholder="Give your idea a title" placeholderTextColor={colors.muted} style={styles.input} value={form.title} onChangeText={(title) => setForm((value) => ({ ...value, title }))} editable={!saving && !addingCategory} maxLength={240} />
      <AppText variant="label">Content</AppText>
      <TextInput accessibilityLabel="Note content" placeholder="Write something…" placeholderTextColor={colors.muted} style={[styles.input, styles.body]} multiline value={form.body} onChangeText={(body) => setForm((value) => ({ ...value, body }))} editable={!saving && !addingCategory} maxLength={100000} />
      <AppText variant="caption" tone="muted">A title or content is required. Content-only notes use “Untitled note”.</AppText>
      <AppText variant="label">Category (optional)</AppText>
      <CategoryPicker categories={editor.categories} value={form.categoryId} onChange={(categoryId) => setForm((value) => ({ ...value, categoryId: categoryId ?? null }))} disabled={saving || addingCategory} />
      <TextInput accessibilityLabel="New category name" placeholder="New category name" placeholderTextColor={colors.muted} value={categoryName} onChangeText={setCategoryName} maxLength={80} editable={!saving && !addingCategory} style={styles.input} />
      <AppButton label={addingCategory ? 'Adding category…' : 'Add category'} variant="secondary" onPress={() => { void addCategory(); }} disabled={saving || addingCategory || !categoryName.trim()} />
      <AppButton label={saving ? 'Saving…' : 'Save note'} icon={Save} onPress={() => { Keyboard.dismiss(); void editor.save(); }} disabled={saving || addingCategory} />
    </View>}
  </ScreenContainer>;
}
