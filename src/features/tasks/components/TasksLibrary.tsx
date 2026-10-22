import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CheckSquare, Plus } from 'lucide-react-native';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import EmptyState from '../../../components/ui/EmptyState.tsx';
import { spacing } from '../../../theme/index.ts';
import { useTasksList, taskError } from '../hooks/useTasks.ts';
import TaskListItem from './TaskListItem.tsx';
import {
  TaskCategories,
  TaskChip,
  TaskChipRow,
  TaskError,
  TaskStorageNotice,
} from './TaskControls.tsx';
import { useTaskStyles } from './taskStyles.ts';
const filters = ['today', 'upcoming', 'overdue', 'completed', 'all'] as const;
const sorts = ['due', 'priority', 'recent'] as const;
const sortLabels = { due: 'Due date', priority: 'Priority', recent: 'Recently updated' };
export default function TasksLibrary() {
  const styles = useTaskStyles();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all' as (typeof filters)[number]);
  const [sort, setSort] = useState('due' as (typeof sorts)[number]);
  const [categoryId, setCategoryId] = useState(undefined as string | null | undefined);
  const { tasks, categories, loading, error, refresh, loadMore, tasksService } = useTasksList({
    search,
    filter,
    sort,
    categoryId,
  });
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function perform(operation: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError('');
    try {
      await operation();
    } catch (failure) {
      setActionError(taskError(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={tasks}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        windowSize={7}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        onRefresh={refresh}
        refreshing={loading && tasks.length > 0}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xl }} />}
        renderItem={({ item }) => (
          <TaskListItem
            task={item}
            category={
              categories.find((category) => category.id === item.categoryId)?.name ??
              'Uncategorized'
            }
            busy={busy}
            onOpen={() => router.push({ pathname: '/task/[id]', params: { id: item.id } })}
            onStatus={() => {
              void perform(() =>
                tasksService.setTaskStatus(
                  item.id,
                  item.status === 'completed' ? 'todo' : 'completed',
                ),
              );
            }}
            onDelete={() =>
              Alert.alert(
                'Delete task?',
                'This permanently deletes the task and its subtasks from this device.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void perform(() => tasksService.deleteTask(item.id, true));
                    },
                  },
                ],
              )
            }
          />
        )}
        ListHeaderComponent={
          <View style={styles.section}>
            <AppHeader title="Tasks" subtitle="One small step at a time" />
            <TaskStorageNotice />
            <TextInput
              accessibilityLabel="Search tasks"
              placeholder="Search title and description"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={search}
              onChangeText={setSearch}
              maxLength={1000}
            />
            <TaskChipRow>
              {filters.map((value) => (
                <TaskChip
                  key={value}
                  label={value[0].toUpperCase() + value.slice(1)}
                  selected={filter === value}
                  onPress={() => setFilter(value)}
                />
              ))}
            </TaskChipRow>
            <TaskChipRow>
              {sorts.map((value) => (
                <TaskChip
                  key={value}
                  label={sortLabels[value]}
                  selected={sort === value}
                  onPress={() => setSort(value)}
                />
              ))}
            </TaskChipRow>
            <TaskCategories
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              filter
            />
            <AppButton
              label="Manage task categories"
              variant="secondary"
              onPress={() => router.push('/task/categories')}
            />
            {error && <TaskError message={error} onRetry={refresh} />}
            {actionError && <TaskError message={actionError} />}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading tasks" />
          ) : !error ? (
            <EmptyState
              icon={CheckSquare}
              title="No tasks here"
              description="Create a task or try another search or filter."
            />
          ) : undefined
        }
        ListFooterComponent={
          loading && tasks.length > 0 ? <ActivityIndicator color={colors.primary} /> : undefined
        }
      />
      <View style={styles.fab}>
        <AppButton label="Create task" icon={Plus} onPress={() => router.push('/task/new')} />
      </View>
    </SafeAreaView>
  );
}
