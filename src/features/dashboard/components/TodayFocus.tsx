import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useCalendarRange } from '../../calendar/hooks/useCalendar.ts';
import { addDays, localToday } from '../../calendar/services/calendarDates.ts';
import type { CalendarEntry } from '../../calendar/services/calendarService.ts';
import { useDashboardStyles } from './dashboardStyles.ts';

function timeLabel(civil: string) {
  const hours = Number(civil.slice(11, 13));
  return `${hours % 12 || 12}:${civil.slice(14, 16)} ${hours < 12 ? 'AM' : 'PM'}`;
}
function openEntry(entry: CalendarEntry) {
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

export default function TodayFocus() {
  const styles = useDashboardStyles();
  const { colors } = useTheme();
  const today = localToday();
  const query = useCalendarRange(today, addDays(today, 1));
  const entries = query.entries
    .filter((entry) => entry.type !== 'task' || entry.status !== 'completed')
    .slice(0, 4);
  return (
    <View style={styles.list}>
      {query.error ? (
        <Pressable onPress={query.refresh} accessibilityRole="button" style={styles.empty}>
          <AppText tone="muted">Today’s focus could not load. Tap to retry.</AppText>
        </Pressable>
      ) : query.loading ? (
        <AppText tone="muted" style={styles.empty}>
          Loading today’s focus…
        </AppText>
      ) : !entries.length ? (
        <AppText tone="muted" style={styles.empty}>
          A little breathing room. No events or open task deadlines today.
        </AppText>
      ) : (
        entries.map((entry, index) => {
          const category =
            entry.type === 'event'
              ? query.categories.find((item) => item.id === entry.categoryId)
              : null;
          const dot =
            entry.type === 'task'
              ? entry.priority === 'urgent'
                ? '#E55D76'
                : entry.priority === 'high'
                  ? '#ED9B42'
                  : colors.primary
              : (category?.color ?? colors.primary);
          const detail = entry.allDay
            ? 'All day'
            : entry.type === 'task'
              ? `Due ${timeLabel(entry.startLocal)}`
              : `${timeLabel(entry.startLocal)} – ${timeLabel(entry.endLocal)}`;
          return (
            <Pressable
              key={entry.instanceId}
              accessibilityRole="button"
              accessibilityLabel={`${entry.title}. ${detail}`}
              onPress={() => openEntry(entry)}
              style={({ pressed }) => [
                styles.listRow,
                index > 0 && styles.separator,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: dot }]} />
              <View style={styles.rowCopy}>
                <AppText variant="label" numberOfLines={2}>
                  {entry.title}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {detail}
                </AppText>
              </View>
              <AppText tone="muted" style={styles.rowDate}>
                {today.slice(5).replace('-', '/')}
              </AppText>
              <ChevronRight color={colors.muted} size={16} accessible={false} />
            </Pressable>
          );
        })
      )}
    </View>
  );
}
