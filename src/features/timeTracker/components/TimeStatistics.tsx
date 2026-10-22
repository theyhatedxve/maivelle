import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { useTimeData } from '../hooks/useTimeTracker.ts';
import { dayKey, formatDuration, periods } from '../services/timeAnalytics.ts';
import { TimeChip, TimeError, TimeLoading, TimeStorageNotice } from './TimeControls.tsx';
import { useTimeStyles } from './timeStyles.ts';
export default function TimeStatistics() {
  const styles = useTimeStyles();
  const { colors } = useTheme();
  const { timeTrackerService: service } = useDatabase();
  const [period, setPeriod] = useState('week' as 'day' | 'week' | 'month');
  const load = useCallback(async () => {
    const now = Date.now();
    const from = periods(now)[period];
    return { stats: await service.statistics(from, now + 1), from, now };
  }, [service, period]);
  const state = useTimeData(load);
  const days = [];
  if (state.data) {
    const cursor = new Date(state.data.from);
    while (cursor.getTime() <= state.data.now) {
      const date = dayKey(cursor.getTime());
      days.push({
        date,
        durationMs: state.data.stats.days.find((d) => d.date === date)?.durationMs ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const max = Math.max(1, ...days.map((d) => d.durationMs));
  return (
    <ScreenContainer>
      <AppHeader title="Time statistics" subtitle="Your tracked time, on this device" back />
      <TimeStorageNotice />
      <View style={styles.row}>
        {(['day', 'week', 'month'] as const).map((value) => (
          <TimeChip
            key={value}
            label={value === 'day' ? 'Today' : value === 'week' ? 'This week' : 'This month'}
            selected={period === value}
            onPress={() => setPeriod(value)}
          />
        ))}
      </View>
      <TimeError message={state.error} onRetry={state.refresh} />
      {state.loading && <TimeLoading />}
      {state.data && (
        <View style={styles.section}>
          <AppCard>
            <AppText variant="title">{formatDuration(state.data.stats.totalMs)}</AppText>
            <AppText>
              {state.data.stats.sessionCount}{' '}
              {state.data.stats.sessionCount === 1 ? 'session' : 'sessions'} contributing time
            </AppText>
            <AppText tone="muted">
              {new Date(state.data.from).toLocaleDateString()} –{' '}
              {new Date(state.data.now).toLocaleDateString()} · Local timezone · Week starts Monday
            </AppText>
          </AppCard>
          <AppText variant="title">Daily active time</AppText>
          <Svg
            width="100%"
            height={140}
            viewBox={`0 0 ${Math.max(1, days.length) * 24} 120`}
            preserveAspectRatio="none"
            accessible={false}
          >
            {days.map((day, index) => (
              <Rect
                key={day.date}
                x={index * 24 + 3}
                y={120 - (day.durationMs / max) * 110}
                width={18}
                height={(day.durationMs / max) * 110}
                rx={3}
                fill={colors.primary}
              />
            ))}
          </Svg>
          <AppText variant="caption" tone="muted">
            Bars run from the first date to today. Exact totals appear below.
          </AppText>
          {days.map((day) => (
            <View key={day.date} style={styles.row}>
              <AppText style={styles.flex}>{day.date}</AppText>
              <AppText tone="primary">{formatDuration(day.durationMs)}</AppText>
            </View>
          ))}
          <AppText variant="title">Activity distribution</AppText>
          {!state.data.stats.projects.length && (
            <AppText tone="muted">No tracked time in this period yet.</AppText>
          )}
          {state.data.stats.projects.map((project) => (
            <AppCard key={project.id}>
              <View style={styles.row}>
                <View style={[styles.color, { backgroundColor: project.color }]} />
                <AppText variant="label">{project.name}</AppText>
              </View>
              <AppText>
                {formatDuration(project.durationMs)} · {project.sessionCount}{' '}
                {project.sessionCount === 1 ? 'session' : 'sessions'} ·{' '}
                {Math.round(
                  (project.durationMs / Math.max(1, state.data?.stats.totalMs ?? 0)) * 100,
                )}
                %
              </AppText>
              <Svg
                width="100%"
                height={12}
                viewBox="0 0 100 12"
                preserveAspectRatio="none"
                accessible={false}
              >
                <Rect width={100} height={12} rx={4} fill={colors.lavender} />
                <Rect
                  width={(project.durationMs / Math.max(1, state.data?.stats.totalMs ?? 0)) * 100}
                  height={12}
                  rx={4}
                  fill={project.color}
                />
              </Svg>
            </AppCard>
          ))}
          <AppText variant="caption" tone="muted">
            Paused time is excluded. Running timers are provisional. Overlapping independent manual
            entries are counted separately; these totals describe recorded activity, not unique
            wall-clock occupancy. Zero-duration entries remain in history but do not count as
            contributing sessions.
          </AppText>
        </View>
      )}
    </ScreenContainer>
  );
}
