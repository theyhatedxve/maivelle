import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { router } from 'expo-router';
import { ArrowUpRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import IconBadge from '../../../components/ui/IconBadge.tsx';
import { spacing } from '../../../theme/index.ts';
import { dashboardData } from '../data/dashboardData.ts';
import { moduleIcons } from './moduleIcons.ts';
import { useNotesCount } from '../../notes/hooks/useNotes.ts';
import { useTaskSummary } from '../../tasks/hooks/useTasks.ts';
import { useUpcomingEvents } from '../../calendar/hooks/useCalendar.ts';
import { useMedicineSummary } from '../../medicine/hooks/useMedicine.ts';
import { useTimeSummary } from '../../timeTracker/hooks/useTimeTracker.ts';
import { formatDuration } from '../../timeTracker/services/timeAnalytics.ts';
import { useFinanceSummary } from '../../finance/hooks/useFinance.ts';
import { formatMoney } from '../../finance/services/money.ts';
import { useBudgets } from '../../budget/hooks/useBudget.ts';
import { financialToday } from '../../finance/services/financeLedger.ts';
import { useVault } from '../../vault/providers/VaultProvider.tsx';
export default function ModuleGrid() {
  const { colors } = useTheme();
  const { state: vaultState } = useVault();
  const { count, error } = useNotesCount();
  const { summary, error: tasksError } = useTaskSummary();
  const calendar = useUpcomingEvents();
  const medicine = useMedicineSummary();
  const timer = useTimeSummary();
  const finance = useFinanceSummary();
  const budgets = useBudgets();
  const today = financialToday();
  const modules = dashboardData.modules.map((module) => {
    if (module.id === 'vault')
      return {
        ...module,
        value: !vaultState.ready
          ? 'Unavailable'
          : !vaultState.configured
            ? 'Set up'
            : vaultState.locked
              ? 'Locked'
              : 'Unlocked',
        detail: 'encrypted Vault · fictional development records only',
      };
    if (module.id === 'notes')
      return {
        ...module,
        value: error ? 'Unavailable' : count === null ? '…' : String(count),
        detail: error ? 'Open Notes to retry' : 'active notes on device',
      };
    if (module.id === 'tasks')
      return {
        ...module,
        value: tasksError ? 'Unavailable' : summary === null ? '…' : String(summary.incomplete),
        detail: tasksError
          ? 'Open Tasks to retry'
          : `${summary?.today ?? '…'} due today · incomplete tasks`,
      };
    if (module.id === 'calendar')
      return {
        ...module,
        value: calendar.error
          ? 'Unavailable'
          : calendar.loading
            ? '…'
            : String(calendar.events.length),
        detail: calendar.error ? 'Open Calendar to retry' : 'events in the next 30 days',
      };
    if (module.id === 'medicine')
      return {
        ...module,
        value: medicine.error
          ? 'Unavailable'
          : medicine.loading
            ? '…'
            : String(medicine.data?.scheduled ?? 0),
        detail: medicine.error
          ? 'Open Medicine to retry'
          : `${medicine.data?.completed ?? 0} completed today · ${medicine.data?.taken ?? 0} taken, ${medicine.data?.skipped ?? 0} skipped`,
      };
    if (module.id === 'timer')
      return {
        ...module,
        value: timer.error
          ? 'Unavailable'
          : timer.loading
            ? '…'
            : formatDuration(timer.data?.today.totalMs ?? 0),
        detail: timer.error
          ? 'Open Timer to retry'
          : `today · ${timer.data?.active?.status ?? 'no active timer'}`,
      };
    if (module.id === 'finance')
      return {
        ...module,
        value: finance.error
          ? 'Unavailable'
          : finance.loading
            ? '…'
            : formatMoney(
                finance.data?.totals.find((total) => total.currency === 'PHP')?.balanceMinor ?? 0n,
              ),
        detail: finance.error
          ? 'Open Finance to retry'
          : 'recorded PHP balance · other currencies separate',
      };
    if (module.id === 'budget') {
      const current =
        budgets.data?.reports.filter(
          (b) => !b.archived && b.currency === 'PHP' && b.starts_on <= today && b.ends_on >= today,
        ) ?? [];
      return {
        ...module,
        value: budgets.error
          ? 'Unavailable'
          : budgets.loading
            ? '…'
            : formatMoney(current.reduce((sum, b) => sum + b.remaining, 0n)),
        detail: budgets.error
          ? 'Open Budget to retry'
          : `${current.length} current PHP budgets · remaining plan, not account balance`,
      };
    }
    return module;
  });
  return (
    <View style={styles.grid}>
      {modules.map((module) => (
        <AppCard
          key={module.id}
          style={styles.card}
          onPress={() => router.push(module.href)}
          accessibilityLabel={`Open ${module.title}, ${module.value} ${module.detail}${['notes', 'tasks', 'calendar', 'medicine', 'timer', 'finance', 'budget', 'vault'].includes(module.id) ? '' : ', sample data'}`}
        >
          <View style={styles.row}>
            <IconBadge icon={moduleIcons[module.id]} />
            <ArrowUpRight size={18} color={colors.muted} accessible={false} />
          </View>
          <AppText variant="label">{module.title}</AppText>
          <AppText variant="title">{module.value}</AppText>
          <AppText variant="caption" tone="muted">
            {module.detail}
          </AppText>
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
