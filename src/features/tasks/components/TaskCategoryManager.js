import { useCallback, useRef, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useFocusEffect, usePreventRemove } from 'expo-router';
import { useDatabase } from '../../../database/DatabaseProvider';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import AppButton from '../../../components/ui/AppButton';
import AppText from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { taskError } from '../hooks/useTasks';
import { TaskError } from './TaskControls';
import { taskStyles as styles } from './taskStyles';

export default function TaskCategoryManager() {
  const { tasksService } = useDatabase();
  const [categories, setCategories] = useState(/** @type {import('../../../database/repositories/tasksRepository.js').TaskCategory[]} */ ([]));
  const [editing, setEditing] = useState(/** @type {string | null} */ (null)); const [name, setName] = useState(''); const [original, setOriginal] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [leaving, setLeaving] = useState(false); const lock = useRef(false);
  usePreventRemove(!leaving && (name !== original || busy), ({ repeat }) => { if (lock.current) return; Alert.alert('Discard category changes?', 'The unsaved category name will be lost.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => { setLeaving(true); repeat(); } }]); });
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => { tasksService.listCategories().then((value) => { if (active) setCategories(value); }).catch((failure) => { if (active) setError(taskError(failure)); }); };
    refresh(); const unsubscribe = tasksService.subscribe(refresh); return () => { active = false; unsubscribe(); };
  }, [tasksService]));
  function reset() { setEditing(null); setName(''); setOriginal(''); }
  async function perform(/** @type {() => Promise<unknown>} */ operation, clear = false) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await operation(); if (clear) reset(); } catch (failure) { setError(taskError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <ScreenContainer><AppHeader title="Task categories" back /><View style={styles.section}>
    <AppText tone="muted">Removing a category keeps all its tasks as Uncategorized.</AppText>{error && <TaskError message={error} />}
    <TextInput accessibilityLabel="Task category name" placeholder="Category name" placeholderTextColor={colors.muted} value={name} onChangeText={setName} style={styles.input} maxLength={80} editable={!busy} />
    <View style={styles.row}><AppButton label={busy ? 'Saving…' : editing ? 'Rename category' : 'Add category'} onPress={() => { void perform(() => editing ? tasksService.updateCategory(editing, name) : tasksService.createCategory(name), true); }} disabled={busy || !name.trim()} /><AppButton label="Cancel category draft" variant="secondary" onPress={reset} disabled={busy} /></View>
    {categories.map((category) => <View key={category.id} style={styles.subtask}><AppText variant="label">{category.name}</AppText><View style={styles.row}>
      <AppButton label="Rename" accessibilityLabel={`Rename category ${category.name}`} variant="secondary" disabled={busy || !!editing || !!name} onPress={() => { setEditing(category.id); setName(category.name); setOriginal(category.name); }} />
      <AppButton label="Remove" accessibilityLabel={`Remove category ${category.name}`} variant="secondary" disabled={busy || editing === category.id} onPress={() => Alert.alert('Remove category?', 'Its tasks will be preserved as Uncategorized.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void perform(() => tasksService.deleteCategory(category.id, true)); } }])} />
    </View></View>)}
  </View></ScreenContainer>;
}
