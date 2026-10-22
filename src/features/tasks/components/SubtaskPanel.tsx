import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CheckSquare, Square, Pencil, Trash2 } from 'lucide-react-native';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { taskError } from '../hooks/useTasks.ts';
import { TaskError } from './TaskControls.tsx';
import { useTaskStyles } from './taskStyles.ts';

export type SubtaskPanelProps = {
  taskId: string;
  onDirtyChange: (dirty: boolean) => void;
  disabled: boolean;
};

export default function SubtaskPanel({ taskId, onDirtyChange, disabled }: SubtaskPanelProps) {
  const styles = useTaskStyles();
  const { colors } = useTheme();
  const { tasksService } = useDatabase();
  const [items, setItems] = useState(
    [] as import('../../../database/repositories/tasksRepository.ts').Subtask[],
  );
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(
    null as import('../../../database/repositories/tasksRepository.ts').Subtask | null,
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const revision = useRef(0);
  const refresh = useCallback(() => {
    const request = ++revision.current;
    tasksService
      .listSubtasks(taskId)
      .then((value) => {
        if (request === revision.current) {
          setItems(value);
          setLoading(false);
        }
      })
      .catch((failure) => {
        if (request === revision.current) {
          setError(taskError(failure));
          setLoading(false);
        }
      });
  }, [taskId, tasksService]);
  useFocusEffect(
    useCallback(() => {
      refresh();
      const unsubscribe = tasksService.subscribe(refresh);
      return () => {
        revision.current++;
        unsubscribe();
      };
    }, [refresh, tasksService]),
  );
  function reset() {
    setTitle('');
    setEditing(null);
    onDirtyChange(false);
  }
  async function perform(operation: () => Promise<unknown>, clear = false) {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
      if (clear) reset();
    } catch (failure) {
      setError(taskError(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={styles.section}>
      <AppText variant="heading">
        Subtasks · {items.filter((item) => item.completed).length}/{items.length}
      </AppText>
      <AppText variant="caption" tone="muted">
        Checklist changes save immediately. Finish or cancel a draft before saving the task.
      </AppText>
      {loading && <ActivityIndicator color={colors.primary} />}
      {error && <TaskError message={error} onRetry={refresh} />}
      {items.map((item) => (
        <View key={item.id} style={styles.subtask}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: item.completed,
              disabled: busy || disabled || !!editing,
            }}
            accessibilityLabel={`Subtask ${item.title}`}
            disabled={busy || disabled || !!editing}
            style={styles.row}
            onPress={() => {
              void perform(() => tasksService.updateSubtask(item.id, item.title, !item.completed));
            }}
          >
            {item.completed ? (
              <CheckSquare size={24} color={colors.primary} />
            ) : (
              <Square size={24} color={colors.primary} />
            )}
            <AppText>{item.title}</AppText>
          </Pressable>
          <View style={styles.row}>
            <AppButton
              label="Edit subtask"
              icon={Pencil}
              variant="secondary"
              disabled={busy || disabled || !!editing || !!title}
              onPress={() => {
                setEditing(item);
                setTitle(item.title);
              }}
              accessibilityLabel={`Edit subtask ${item.title}`}
            />
            <AppButton
              label="Delete subtask"
              icon={Trash2}
              variant="secondary"
              disabled={busy || disabled}
              onPress={() =>
                Alert.alert('Delete subtask?', 'Remove this checklist item?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void perform(() => tasksService.deleteSubtask(item.id, true));
                    },
                  },
                ])
              }
              accessibilityLabel={`Delete subtask ${item.title}`}
            />
          </View>
        </View>
      ))}
      <TextInput
        accessibilityLabel="Subtask title"
        placeholder={editing ? 'Edit subtask title' : 'New subtask title'}
        placeholderTextColor={colors.muted}
        value={title}
        onChangeText={(value) => {
          setTitle(value);
          onDirtyChange(editing ? value !== editing.title : !!value);
        }}
        editable={!busy && !disabled}
        style={styles.input}
        maxLength={240}
      />
      <View style={styles.row}>
        <AppButton
          label={busy ? 'Saving checklist…' : editing ? 'Save subtask' : 'Add subtask'}
          disabled={busy || disabled || !title.trim()}
          onPress={() => {
            void perform(
              () =>
                editing
                  ? tasksService.updateSubtask(editing.id, title, editing.completed)
                  : tasksService.createSubtask(taskId, title),
              true,
            );
          }}
        />
        {(editing || title) && (
          <AppButton
            label="Cancel draft"
            variant="secondary"
            onPress={reset}
            disabled={busy || disabled}
          />
        )}
      </View>
    </View>
  );
}
