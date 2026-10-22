import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { memo } from 'react';
import { View } from 'react-native';
import { Check, RotateCcw, Trash2, Flag } from 'lucide-react-native';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { statusLabels } from '../validation/taskInput.ts';
import { dueLabel } from '../services/taskDates.ts';
import { useTaskStyles } from './taskStyles.ts';

export type TaskListItemProps = {
  task: import('../../../database/repositories/tasksRepository.ts').Task & {
    overdue: boolean;
  };
  category: string;
  onOpen: () => void;
  onStatus: () => void;
  onDelete: () => void;
  busy: boolean;
};

function TaskListItem({ task, category, onOpen, onStatus, onDelete, busy }: TaskListItemProps) {
  const styles = useTaskStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <AppCard onPress={onOpen} accessibilityLabel={`Open task ${task.title}`}>
        <AppText variant="heading" numberOfLines={2}>
          {task.title}
        </AppText>
        <View style={styles.row}>
          <Flag size={16} color={colors.primary} accessible={false} />
          <AppText variant="label" tone="primary">
            {task.priority.toUpperCase()} · {statusLabels[task.status]}
          </AppText>
        </View>
        {!!task.description && (
          <AppText tone="muted" numberOfLines={2}>
            {task.description.slice(0, 240)}
          </AppText>
        )}
        <AppText variant="caption" tone={task.overdue ? 'primary' : 'muted'}>
          {task.overdue ? 'Overdue · ' : ''}
          {dueLabel(task)}
        </AppText>
        <AppText variant="caption" tone="muted">
          {category} · Subtasks {task.completedSubtaskCount}/{task.subtaskCount}
        </AppText>
      </AppCard>
      <View style={styles.row}>
        <AppButton
          label={task.status === 'completed' ? 'Reopen' : 'Complete'}
          icon={task.status === 'completed' ? RotateCcw : Check}
          variant="secondary"
          accessibilityLabel={`${task.status === 'completed' ? 'Reopen' : 'Complete'} ${task.title}`}
          onPress={onStatus}
          disabled={busy}
        />
        <AppButton
          label="Delete"
          icon={Trash2}
          variant="secondary"
          accessibilityLabel={`Delete task ${task.title}`}
          onPress={onDelete}
          disabled={busy}
        />
      </View>
    </View>
  );
}
export default memo(TaskListItem);
