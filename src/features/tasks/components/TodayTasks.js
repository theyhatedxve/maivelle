import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import AppCard from '../../../components/ui/AppCard';
import AppText from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { useTasksList } from '../hooks/useTasks';
import { dueLabel } from '../services/taskDates';
import { TaskError } from './TaskControls';
import { taskStyles as styles } from './taskStyles';

export default function TodayTasks() {
  const { tasks, loading, error, refresh } = useTasksList({ filter: 'today', sort: 'due', limit: 3 });
  return <View style={styles.section}>
    {error ? <TaskError message={error} onRetry={refresh} /> : loading && !tasks.length ? <ActivityIndicator color={colors.primary} /> : !tasks.length ? <AppText tone="muted">No incomplete tasks due today.</AppText> : tasks.map((task) => <AppCard key={task.id} onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })} accessibilityLabel={`Open today's task ${task.title}`}><AppText variant="label">{task.title}</AppText><AppText variant="caption" tone="muted">{task.overdue ? 'Overdue · ' : ''}{dueLabel(task)} · {task.priority}</AppText></AppCard>)}
  </View>;
}
