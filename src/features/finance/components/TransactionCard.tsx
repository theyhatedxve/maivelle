import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { router } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react-native';
import { View } from 'react-native';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import { formatMoney } from '../services/money.ts';
import { useFinanceStyles } from './financeStyles.ts';

export type TransactionCardProps = {
  record: import('../../../database/repositories/financeRepository.ts').FinancialTransaction;
};

export default function TransactionCard({ record }: TransactionCardProps) {
  const styles = useFinanceStyles();
  const { colors } = useTheme();
  const Icon =
    record.type === 'transfer'
      ? ArrowLeftRight
      : record.type === 'income'
        ? ArrowDownLeft
        : ArrowUpRight;
  return (
    <AppCard
      onPress={() =>
        router.push({
          pathname: '/financial/transaction/[id]',
          params: { id: record.id },
        })
      }
      accessibilityLabel={`Edit ${record.type}: ${record.description || record.category_label}, ${formatMoney(record.amount_minor, record.currency)}`}
    >
      <View style={styles.row}>
        <Icon size={20} color={colors.primary} />
        <AppText variant="title">{formatMoney(record.amount_minor, record.currency)}</AppText>
      </View>
      <AppText variant="label">
        {record.type.toUpperCase()} · {record.occurred_on}
      </AppText>
      <AppText>
        {record.account_name}
        {record.to_account_name ? ` → ${record.to_account_name}` : ''}
      </AppText>
      {record.type !== 'transfer' && (
        <AppText tone="muted">
          {record.category_label}
          {!record.category_id && record.category_key ? ' (deleted category)' : ''}
        </AppText>
      )}
      {!!record.description && <AppText>{record.description}</AppText>}
    </AppCard>
  );
}
