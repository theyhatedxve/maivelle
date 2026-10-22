import { router } from 'expo-router';
import { View } from 'react-native';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  History,
  ChartColumn,
  Tags,
  PiggyBank,
} from 'lucide-react-native';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useFinanceSummary } from '../hooks/useFinance.ts';
import { formatMoney } from '../services/money.ts';
import { FinanceNotice, FinanceError, FinanceLoading } from './FinanceControls.tsx';
import TransactionCard from './TransactionCard.tsx';
import { useFinanceStyles } from './financeStyles.ts';
export default function FinanceDashboard() {
  const styles = useFinanceStyles();
  const state = useFinanceSummary();
  const report = state.data;
  return (
    <ScreenContainer tabScreen>
      <AppHeader title="Finance" subtitle="Your money, on this device" settings />
      <FinanceNotice />
      <View style={styles.section}>
        <View style={styles.row}>
          <AppButton
            label="Add expense"
            icon={ArrowUpRight}
            onPress={() =>
              router.push({
                pathname: '/financial/transaction/new',
                params: { type: 'expense' },
              })
            }
          />
          <AppButton
            label="Add income"
            icon={ArrowDownLeft}
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/financial/transaction/new',
                params: { type: 'income' },
              })
            }
          />
          <AppButton
            label="Transfer money"
            icon={ArrowLeftRight}
            variant="secondary"
            onPress={() => router.push('/financial/transfer')}
          />
        </View>
        <View style={styles.row}>
          <AppButton
            label="Accounts"
            icon={Wallet}
            variant="secondary"
            onPress={() => router.push('/financial/accounts')}
          />
          <AppButton
            label="Transaction history"
            icon={History}
            variant="secondary"
            onPress={() => router.push('/financial/history')}
          />
          <AppButton
            label="Categories"
            icon={Tags}
            variant="secondary"
            onPress={() => router.push('/financial/categories')}
          />
          <AppButton
            label="Reports"
            icon={ChartColumn}
            variant="secondary"
            onPress={() => router.push('/financial/reports')}
          />
        </View>
      </View>
      <FinanceError message={state.error} onRetry={state.refresh} />
      {state.loading && <FinanceLoading />}
      {report && (
        <View style={styles.section}>
          <AppCard>
            <AppText variant="title">Total recorded balances</AppText>
            {(report.totals.length ? report.totals : [{ currency: 'PHP', balanceMinor: 0n }]).map(
              (total) => (
                <AppText key={total.currency} variant="title" tone="primary">
                  {formatMoney(total.balanceMinor, total.currency)}
                </AppText>
              ),
            )}
            <AppText variant="caption" tone="muted">
              Opening balances plus all transactions, including archived accounts. Currencies are
              separate; no exchange rates are applied.
            </AppText>
          </AppCard>
          <AppCard>
            <AppText variant="title">{report.month} · PHP cash flow</AppText>
            <AppText>Income: {formatMoney(report.incomeMinor)}</AppText>
            <AppText>Expenses: {formatMoney(report.expenseMinor)}</AppText>
            <AppText tone="primary">Net cash flow: {formatMoney(report.netMinor)}</AppText>
            <AppText variant="caption" tone="muted">
              Opening balances and transfers are excluded from income and expenses.
            </AppText>
          </AppCard>
          {!report.accounts.length && (
            <AppCard>
              <AppText variant="title">Start with a fictional account</AppText>
              <AppText>
                Create a Cash, Bank, E-Wallet or Other account before recording transactions.
              </AppText>
              <AppButton
                label="Create account"
                onPress={() => router.push('/financial/account/new')}
              />
            </AppCard>
          )}
          <AppText variant="title">Recent PHP transactions this month</AppText>
          {!report.recent.length && (
            <AppText tone="muted">
              No transactions this month. Add an income, expense or transfer to begin.
            </AppText>
          )}
          {report.recent.map((record) => (
            <TransactionCard key={record.id} record={record} />
          ))}
          <AppButton
            label="Explore Budget"
            icon={PiggyBank}
            variant="secondary"
            onPress={() => router.push('/budget')}
          />
        </View>
      )}
    </ScreenContainer>
  );
}
