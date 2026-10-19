import { useState } from 'react';
import { ActivityIndicator, Keyboard, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { FileQuestion, Save } from 'lucide-react-native';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import AppText from '../../../components/ui/AppText';
import AppButton from '../../../components/ui/AppButton';
import EmptyState from '../../../components/ui/EmptyState';
import { colors } from '../../../theme';
import { useTaskEditor } from '../hooks/useTaskEditor';
import { priorities, statuses, statusLabels } from '../validation/taskInput';
import { TaskCategories, TaskChip, TaskChipRow, TaskError, TaskStorageNotice } from './TaskControls';
import SubtaskPanel from './SubtaskPanel';
import { taskStyles as styles } from './taskStyles';

/** @param {{id: string | null}} props */
export default function TaskEditor({ id }) {
  const [checklistDirty, setChecklistDirty] = useState(false);
  const editor = useTaskEditor(id, checklistDirty); const { form, setForm, saving } = editor;
  return <ScreenContainer><AppHeader title={id === null ? 'Create task' : 'Edit task'} subtitle={editor.dirty ? 'Unsaved changes' : 'Stored on this device'} back />
    {editor.loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading task" /> : editor.loadFailed ? <TaskError message={editor.error} onRetry={editor.retry} /> : editor.notFound ? <EmptyState icon={FileQuestion} title="Task not found" description="This ID is invalid or the task has been deleted." action={<AppButton label="Back to Tasks" onPress={() => router.dismissTo('/tasks')} />} /> : <View style={styles.section}>
      <TaskStorageNotice />{editor.error && <TaskError message={editor.error} />}
      <AppText variant="label">Title (required)</AppText><TextInput accessibilityLabel="Task title" placeholder="What needs doing?" placeholderTextColor={colors.muted} value={form.title} onChangeText={(title) => setForm((value) => ({ ...value, title }))} style={styles.input} editable={!saving} maxLength={240} />
      <AppText variant="label">Description</AppText><TextInput accessibilityLabel="Task description" placeholder="Add a little detail" placeholderTextColor={colors.muted} value={form.description} onChangeText={(description) => setForm((value) => ({ ...value, description }))} style={[styles.input, styles.body]} multiline editable={!saving} maxLength={100000} />
      <AppText variant="label">Priority</AppText><TaskChipRow>{priorities.map((priority) => <TaskChip key={priority} label={priority[0].toUpperCase() + priority.slice(1)} selected={form.priority === priority} onPress={() => setForm((value) => ({ ...value, priority }))} disabled={saving} />)}</TaskChipRow>
      <AppText variant="label">Status</AppText><TaskChipRow>{statuses.map((status) => <TaskChip key={status} label={statusLabels[status]} selected={form.status === status} onPress={() => setForm((value) => ({ ...value, status }))} disabled={saving} />)}</TaskChipRow>
      <AppText variant="label">Due date (optional)</AppText><TextInput accessibilityLabel="Task due date" placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} value={form.dueDate ?? ''} onChangeText={(dueDate) => setForm((value) => ({ ...value, dueDate: dueDate || null, dueTime: dueDate ? value.dueTime : null }))} style={styles.input} editable={!saving} maxLength={10} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
      <AppText variant="label">Due time (optional)</AppText><TextInput accessibilityLabel="Task due time" placeholder="HH:mm (24-hour)" placeholderTextColor={colors.muted} value={form.dueTime ?? ''} onChangeText={(dueTime) => setForm((value) => ({ ...value, dueTime: dueTime || null }))} style={styles.input} editable={!saving} maxLength={5} keyboardType="numbers-and-punctuation" />
      <AppText variant="caption" tone="muted">Without a time, a task stays due all day. Dates and times follow the device’s local clock.</AppText>
      <AppText variant="label">Category</AppText><TaskCategories categories={editor.categories} value={form.categoryId} onChange={(categoryId) => setForm((value) => ({ ...value, categoryId: categoryId ?? null }))} disabled={saving} />
      <AppButton label="Manage task categories" variant="secondary" onPress={() => router.push('/task/categories')} disabled={saving} />
      {editor.task && <AppText variant="caption" tone="muted">Created {new Date(editor.task.createdAt).toLocaleString()}{editor.task.completedAt ? ` · Completed ${new Date(editor.task.completedAt).toLocaleString()}` : ''}</AppText>}
      {id === null ? <AppText tone="muted">Save the task first, then open it to add subtasks.</AppText> : <SubtaskPanel taskId={id} onDirtyChange={setChecklistDirty} disabled={saving} />}
      <AppButton label={saving ? 'Saving…' : 'Save task'} icon={Save} onPress={() => { Keyboard.dismiss(); void editor.save(); }} disabled={saving || checklistDirty} />
    </View>}
  </ScreenContainer>;
}
