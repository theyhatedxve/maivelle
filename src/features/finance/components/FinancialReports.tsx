import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { useFinanceData, financeError } from '../hooks/useFinance.ts';
import { financialToday, monthBounds } from '../services/financeLedger.ts';
import { currencies, formatMoney, percentage } from '../services/money.ts';
import {
  FinanceNotice,
  FinanceField,
  FinanceChip,
  FinanceError,
  FinanceLoading,
} from './FinanceControls.tsx';
import TransactionCard from './TransactionCard.tsx';
import { useFinanceStyles } from './financeStyles.ts';

export type ViewlessBarsProps = {
  x: number;
  income: number;
  expense: number;
};

export default function FinancialReports() {
  const styles = useFinanceStyles();
  const { colors } = useTheme();
  const { financeService: service } = useDatabase();
  const [month, setMonth] = useState(() => financialToday().slice(0, 7));
  const [currency, setCurrency] = useState('PHP');
  const [applied, setApplied] = useState(() => ({
    month: financialToday().slice(0, 7),
    currency: 'PHP',
  }));
  const [error, setError] = useState('');
  const load = useCallback(
    () => service.report(applied.month, applied.currency),
    [service, applied],
  );
  const state = useFinanceData(load);
  const report = state.data;
  const max =
    report?.trends.reduce(
      (largest, row) =>
        row.incomeMinor > largest
          ? row.expenseMinor > row.incomeMinor
            ? row.expenseMinor
            : row.incomeMinor
          : row.expenseMinor > largest
            ? row.expenseMinor
            : largest,
      1n,
    ) ?? 1n;
  return (
    <ScreenContainer>
      <AppHeader title="Financial reports" subtitle="Income, spending and recorded balances" back />
      <FinanceNotice />
      <FinanceField label="Report month (YYYY-MM)" value={month} onChange={setMonth} />
      <View style={styles.section}>
        <View style={styles.row}>
          {currencies.map((value) => (
            <FinanceChip
              key={value}
              label={value}
              selected={currency === value}
              onPress={() => setCurrency(value)}
            />
          ))}
        </View>
        <AppButton
          label="Apply report month"
          variant="secondary"
          onPress={() => {
            try {
              monthBounds(month);
              setApplied({ month, currency });
              setError('');
            } catch (failure) {
              setError(financeError(failure));
            }
          }}
        />
      </View>
      <FinanceError message={error} />
      <FinanceError message={state.error} onRetry={state.refresh} />
      {state.loading && <FinanceLoading />}
      {report && (
        <View style={styles.section}>
          <AppCard>
            <AppText variant="title">
              {report.month} · {report.currency}
            </AppText>
            <AppText>Monthly income: {formatMoney(report.incomeMinor, report.currency)}</AppText>
            <AppText>Monthly expenses: {formatMoney(report.expenseMinor, report.currency)}</AppText>
            <AppText tone="primary">
              Net cash flow: {formatMoney(report.netMinor, report.currency)}
            </AppText>
            <AppText variant="caption" tone="muted">
              Transfers and opening balances are excluded from income, expenses and net cash flow.
            </AppText>
          </AppCard>
          <AppText variant="title">Monthly trends</AppText>
          <AppText tone="muted">Purple: income · Lavender: expenses</AppText>
          <Svg
            width="100%"
            height={160}
            viewBox="0 0 216 140"
            preserveAspectRatio="none"
            accessible={false}
          >
            {report.trends.map((row, index) => (
              <ViewlessBars
                key={row.month}
                x={index * 36}
                income={percentage(row.incomeMinor, max)}
                expense={percentage(row.expenseMinor, max)}
              />
            ))}
          </Svg>
          {report.trends.map((row) => (
            <View key={row.month} style={styles.section}>
              <AppText variant="label">{row.month}</AppText>
              <AppText>
                Income {formatMoney(row.incomeMinor, report.currency)} · Expenses{' '}
                {formatMoney(row.expenseMinor, report.currency)}
              </AppText>
            </View>
          ))}
          <AppText variant="title">Spending by category</AppText>
          {!report.categories.length && (
            <AppText tone="muted">No expenses in this month and currency.</AppText>
          )}
          {report.categories.map((category) => (
            <AppCard key={category.id}>
              <AppText variant="label">{category.name}</AppText>
              <AppText>
                {formatMoney(category.amountMinor, report.currency)} ·{' '}
                {percentage(category.amountMinor, report.expenseMinor)}%
              </AppText>
              <Svg
                width="100%"
                height={12}
                viewBox="0 0 100 12"
                preserveAspectRatio="none"
                accessible={false}
              >
                <Rect width={100} height={12} fill={colors.lavender} rx={4} />
                <Rect
                  width={percentage(category.amountMinor, report.expenseMinor)}
                  height={12}
                  fill={category.color}
                  rx={4}
                />
              </Svg>
            </AppCard>
          ))}
          <AppText variant="title">Current account balances</AppText>
          <AppText tone="muted">
            All entered transactions and opening balances, including archived accounts. These are
            current recorded balances, not balances at the selected month end.
          </AppText>
          {!report.accounts.some((account) => account.currency === report.currency) && (
            <AppText>No accounts in {report.currency}.</AppText>
          )}
          {report.accounts
            .filter((account) => account.currency === report.currency)
            .map((account) => (
              <AppCard key={account.id}>
                <AppText variant="label">
                  {account.name}
                  {account.archived ? ' (archived)' : ''}
                </AppText>
                <AppText tone="primary">
                  {formatMoney(account.balanceMinor, account.currency)}
                </AppText>
              </AppCard>
            ))}
          <AppText variant="title">Recent transactions in this month</AppText>
          {!report.recent.length && (
            <AppText tone="muted">No transactions for this report.</AppText>
          )}
          {report.recent.map((record) => (
            <TransactionCard key={record.id} record={record} />
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}
/** SVG primitives only; no native View can be placed inside an SVG. */
function ViewlessBars({ x, income, expense }: ViewlessBarsProps) {
  const { colors } = useTheme();
  return (
    <>
      <Rect
        x={x + 4}
        y={140 - income * 1.3}
        width={12}
        height={income * 1.3}
        fill={colors.primary}
        rx={2}
      />
      <Rect
        x={x + 18}
        y={140 - expense * 1.3}
        width={12}
        height={expense * 1.3}
        fill={colors.accent}
        rx={2}
      />
    </>
  );
}
