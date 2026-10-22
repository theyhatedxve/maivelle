import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { router } from 'expo-router';
import { View } from 'react-native';
import { CalendarDays, CheckSquare, Repeat } from 'lucide-react-native';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import { statusLabels } from '../../tasks/validation/taskInput.ts';
import { addDays } from '../services/calendarDates.ts';
import { useCalendarStyles } from './calendarStyles.ts';

export type CalendarEntryCardProps = {
  entry: import('../services/calendarService.ts').CalendarEntry;
  categories: import('../../../database/repositories/calendarRepository.ts').CalendarCategory[];
};

export default function CalendarEntryCard({ entry, categories }: CalendarEntryCardProps) {
  const styles = useCalendarStyles();
  const { colors } = useTheme();
  const task = entry.type === 'task';
  const category = task ? null : categories.find((item) => item.id === entry.categoryId);
  const label = task ? `Task deadline ${entry.title}` : `Open event ${entry.title}`;
  return (
    <AppCard
      onPress={() =>
        task
          ? router.push({ pathname: '/task/[id]', params: { id: entry.id } })
          : router.push({
              pathname: '/event/[id]',
              params: {
                id: entry.eventId,
                ...(entry.recurrence ? { occurrence: entry.occurrenceStart } : {}),
              },
            })
      }
      accessibilityLabel={label}
    >
      <View style={styles.row}>
        {task ? (
          <CheckSquare color={colors.primary} size={20} />
        ) : (
          <CalendarDays color={category?.color ?? colors.primary} size={20} />
        )}
        <AppText variant="label">
          {task
            ? `Task · ${statusLabels[entry.status]}`
            : (category?.name ?? 'Event · Uncategorized')}
        </AppText>
        {!task && entry.recurrence && <Repeat size={16} color={colors.primary} />}
      </View>
      <AppText variant="heading">{entry.title}</AppText>
      <AppText variant="caption" tone="muted">
        {task
          ? `${entry.dueDate}${entry.dueTime ? ` at ${entry.dueTime}` : ' · all day deadline'}`
          : entry.allDay
            ? `All day · ${entry.startLocal.slice(0, 10)} to ${addDays(entry.endLocal.slice(0, 10), -1)}`
            : `${entry.startLocal.replace('T', ' ')} → ${entry.endLocal.replace('T', ' ')}`}
      </AppText>
      {!task && entry.overridden && (
        <AppText variant="caption" tone="primary">
          Edited occurrence · originally {entry.occurrenceStart.replace('T', ' ')}
        </AppText>
      )}
      {!task && !!entry.location && (
        <AppText variant="caption" tone="muted">
          {entry.location}
        </AppText>
      )}
    </AppCard>
  );
}
