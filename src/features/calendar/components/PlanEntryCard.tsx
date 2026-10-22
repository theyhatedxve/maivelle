import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { EllipsisVertical, MapPin, Repeat2 } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { usePlanStyles } from './planStyles.ts';
import { planDateLabel, planEntryDescription, planTime } from '../services/planPresentation.ts';
import type { CalendarEntry } from '../services/calendarService.ts';
import type { CalendarCategory } from '../../../database/repositories/calendarRepository.ts';

export default function PlanEntryCard({
  entry,
  categories,
  showDate,
}: {
  entry: CalendarEntry;
  categories: CalendarCategory[];
  showDate: boolean;
}) {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  const category =
    entry.type === 'event' ? categories.find((item) => item.id === entry.categoryId) : null;
  const color =
    category?.color ??
    (entry.type === 'task' && entry.priority === 'urgent' ? '#E55D76' : colors.primary);
  function open() {
    if (entry.type === 'task') router.push({ pathname: '/task/[id]', params: { id: entry.id } });
    else
      router.push({
        pathname: '/event/[id]',
        params: {
          id: entry.eventId,
          ...(entry.recurrence ? { occurrence: entry.occurrenceStart } : {}),
        },
      });
  }
  function menu() {
    Alert.alert(
      entry.title,
      entry.type === 'task'
        ? 'Open the task to update its status or details.'
        : 'Open the event to edit its details or manage this occurrence.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: entry.type === 'task' ? 'Open task' : 'Edit event', onPress: open },
        ...(entry.type === 'event' && entry.recurrence
          ? [
              {
                text: 'Edit entire series',
                onPress: () =>
                  router.push({ pathname: '/event/[id]', params: { id: entry.eventId } }),
              },
            ]
          : []),
      ],
    );
  }
  const subtitle = planEntryDescription(entry);
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timeColumn}>
        <AppText variant="caption" tone="muted" style={styles.timeLabel}>
          {entry.allDay ? 'All day' : planTime(entry.startLocal)}
        </AppText>
        {showDate ? (
          <AppText variant="caption" tone="muted" style={styles.timeLabel}>
            {planDateLabel(entry.startLocal.slice(0, 10), { month: 'short', day: 'numeric' })}
          </AppText>
        ) : null}
      </View>
      <View style={styles.timelineLane}>
        <View style={styles.timelineLine} />
        <View style={[styles.timelineDot, { backgroundColor: color }]} />
      </View>
      <View style={styles.entry}>
        <View style={styles.entryHeader}>
          <Pressable
            style={styles.flex}
            accessibilityRole="button"
            accessibilityLabel={`Open ${entry.type}: ${entry.title}`}
            onPress={open}
          >
            <AppText variant="label">{entry.title}</AppText>
          </Pressable>
          <Pressable
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${entry.title}`}
            onPress={menu}
          >
            <EllipsisVertical color={colors.muted} size={18} accessible={false} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${subtitle}. Open ${entry.title}`}
          onPress={open}
          style={styles.section}
        >
          <View style={styles.entryBottom}>
            <AppText variant="caption" tone="muted">
              {subtitle}
            </AppText>
            <View style={styles.category}>
              <AppText variant="caption" tone="primary">
                {entry.type === 'task'
                  ? `Task · ${entry.status === 'completed' ? 'Done' : entry.priority}`
                  : (category?.name ?? 'Event')}
              </AppText>
            </View>
          </View>
          {entry.type === 'event' && entry.location ? (
            <View style={styles.entryHeader}>
              <MapPin size={13} color={colors.muted} accessible={false} />
              <AppText variant="caption" tone="muted" style={styles.flex}>
                {entry.location}
              </AppText>
            </View>
          ) : null}
          {entry.type === 'event' && entry.recurrence ? (
            <View style={styles.entryHeader}>
              <Repeat2 size={13} color={colors.primary} accessible={false} />
              <AppText variant="caption" tone="primary">
                {entry.overridden ? 'Edited occurrence' : 'Repeating event'}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}
