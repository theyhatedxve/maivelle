import { useCallback } from 'react';
import { View } from 'react-native';
import { CalendarDays, Clock3 } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import type { CalendarEntry } from '../services/calendarService.ts';
import { planDateLabel, scheduledMinutes } from '../services/planPresentation.ts';
import { usePlanStyles } from './planStyles.ts';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { useTimeData } from '../../timeTracker/hooks/useTimeTracker.ts';

export default function PlanSummary({
  entries,
  from,
  to,
}: {
  entries: CalendarEntry[];
  from: string;
  to: string;
}) {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  const { timeTrackerService } = useDatabase();
  const load = useCallback(
    () =>
      timeTrackerService.statistics(
        new Date(`${from}T00:00`).getTime(),
        new Date(`${to}T00:00`).getTime(),
      ),
    [from, to, timeTrackerService],
  );
  const focus = useTimeData(load);
  const minutes = focus.data ? Math.floor(focus.data.totalMs / 60000) : null;
  const planned = scheduledMinutes(entries, from, to);
  const count = entries.filter((item) => item.type === 'event').length;
  return (
    <View style={styles.summary}>
      <View style={styles.stat}>
        <View style={styles.calendarBadge}>
          <CalendarDays size={25} color={colors.primary} accessible={false} />
        </View>
        <View>
          <AppText variant="heading">
            {count} {count === 1 ? 'event' : 'events'}
          </AppText>
          <AppText variant="caption" tone="muted">
            {planDateLabel(from, { month: 'short', day: 'numeric', year: 'numeric' })} ·{' '}
            {entries.length - count} tasks
          </AppText>
        </View>
      </View>
      <View style={styles.stat}>
        <View style={styles.ring}>
          <Clock3 size={19} color={colors.primary} accessible={false} />
        </View>
        <View>
          <AppText variant="heading">
            {minutes === null ? '—' : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}
          </AppText>
          <AppText variant="caption" tone="muted">
            {focus.error
              ? 'Focus time unavailable'
              : focus.loading
                ? 'Loading focus time…'
                : 'Focus time'}
          </AppText>
          <AppText variant="caption" tone="muted">
            {Math.floor(planned / 60)}h {planned % 60}m planned
          </AppText>
        </View>
      </View>
      {focus.error ? <AppText accessibilityRole="alert">{focus.error}</AppText> : null}
    </View>
  );
}
