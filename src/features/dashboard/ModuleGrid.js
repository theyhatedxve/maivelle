import { router } from 'expo-router';
import { ArrowUpRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import AppCard from '../../components/ui/AppCard';
import AppText from '../../components/ui/AppText';
import IconBadge from '../../components/ui/IconBadge';
import { colors, spacing } from '../../theme';
import { dashboardData } from './dashboardData';
import { moduleIcons } from './moduleIcons';
import { useNotesCount } from '../notes/hooks/useNotes';
import { useTaskSummary } from '../tasks/hooks/useTasks';
import { useUpcomingEvents } from '../calendar/hooks/useCalendar';

export default function ModuleGrid() {
  const { count, error } = useNotesCount();
  const { summary, error: tasksError } = useTaskSummary();
  const calendar = useUpcomingEvents();
  const modules = dashboardData.modules.map((module) => {
    if (module.id === 'notes') return { ...module, value: error ? 'Unavailable' : count === null ? '…' : String(count), detail: error ? 'Open Notes to retry' : 'active notes on device' };
    if (module.id === 'tasks') return { ...module, value: tasksError ? 'Unavailable' : summary === null ? '…' : String(summary.incomplete), detail: tasksError ? 'Open Tasks to retry' : `${summary?.today ?? '…'} due today · incomplete tasks` };
    if (module.id === 'calendar') return { ...module, value: calendar.error ? 'Unavailable' : calendar.loading ? '…' : String(calendar.events.length), detail: calendar.error ? 'Open Calendar to retry' : 'events in the next 30 days' };
    return module;
  });
  return (
    <View style={styles.grid}>
      {modules.map((module) => (
        <AppCard key={module.id} style={styles.card} onPress={() => router.push(module.href)} accessibilityLabel={`Open ${module.title}, ${module.value} ${module.detail}${['notes','tasks','calendar'].includes(module.id) ? '' : ', sample data'}`}>
          <View style={styles.row}>
            <IconBadge icon={moduleIcons[module.id]} />
            <ArrowUpRight size={18} color={colors.muted} accessible={false} />
          </View>
          <AppText variant="label">{module.title}</AppText>
          <AppText variant="title">{module.value}</AppText>
          <AppText variant="caption" tone="muted">{module.detail}</AppText>
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { flexGrow: 1, flexBasis: '43%', minWidth: 120 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
