import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { CheckSquare, ChevronRight, Database, FileText, TrendingUp } from 'lucide-react-native';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useNotesCount } from '../../notes/hooks/useNotes.ts';
import { useTaskSummary } from '../../tasks/hooks/useTasks.ts';
import { useFinanceSummary } from '../../finance/hooks/useFinance.ts';
import { formatMoney } from '../../finance/services/money.ts';
import { useDashboardStyles } from './dashboardStyles.ts';

export default function DashboardSummaries({
  vaultCount,
  vaultError,
}: {
  vaultCount: number | null;
  vaultError: string;
}) {
  const styles = useDashboardStyles();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const notes = useNotesCount();
  const tasks = useTaskSummary();
  const finance = useFinanceSummary();
  const cards = [
    {
      id: 'vault',
      label: 'Vault Items',
      value: vaultError ? 'Unavailable' : vaultCount === null ? '…' : String(vaultCount),
      icon: Database,
      href: '/vault',
      money: false,
    },
    {
      id: 'notes',
      label: 'Notes',
      value: notes.error ? 'Unavailable' : notes.count === null ? '…' : String(notes.count),
      icon: FileText,
      href: '/notes',
      money: false,
    },
    {
      id: 'tasks',
      label: 'Open Tasks',
      value: tasks.error
        ? 'Unavailable'
        : tasks.summary === null
          ? '…'
          : String(tasks.summary.incomplete),
      icon: CheckSquare,
      href: '/tasks',
      money: false,
    },
    {
      id: 'income',
      label: 'This Month’s Income',
      value: finance.error
        ? 'Unavailable'
        : finance.loading
          ? '…'
          : formatMoney(finance.data?.incomeMinor ?? 0n).replace('PHP ', '₱'),
      icon: TrendingUp,
      href: '/finance',
      money: true,
    },
  ];
  return (
    <View style={styles.summaryGrid}>
      {cards.map(({ id, label, value, icon: Icon, href, money }) => (
        <AppCard
          key={id}
          style={[styles.summary, (width < 350 || fontScale > 1.3) && styles.summarySingle]}
          onPress={() => router.push(href)}
          accessibilityLabel={`${label}: ${value}. Open ${id === 'income' ? 'Finance. PHP income only' : label}`}
        >
          <View style={styles.badge}>
            <Icon size={25} color={colors.primary} accessible={false} />
          </View>
          <View style={styles.metricCopy}>
            <AppText variant="caption" tone="muted">
              {label}
            </AppText>
            <AppText style={[styles.metricValue, money && styles.moneyValue]}>{value}</AppText>
          </View>
          <ChevronRight size={16} color={colors.muted} accessible={false} />
        </AppCard>
      ))}
    </View>
  );
}
