import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import {
  FinanceError,
  FinanceLoading,
  FinanceNotice,
} from '../../finance/components/FinanceControls.tsx';
import { useFinanceStyles } from '../../finance/components/financeStyles.ts';
import { formatMoney, percentage } from '../../finance/services/money.ts';
import { useFinanceAction } from '../../finance/hooks/useFinance.ts';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { useBudgets } from '../hooks/useBudget.ts';

export type BudgetDetailsProps = {
  id: string;
  report?: boolean;
};

export default function BudgetDetails({ id, report = false }: BudgetDetailsProps) {
  const styles = useFinanceStyles();
  const { colors } = useTheme();
  const state = useBudgets();
  const { budgetService } = useDatabase();
  const action = useFinanceAction();
  const b = state.data?.reports.find((b) => b.id === id);
  const money = (value: number | bigint) => formatMoney(value, b?.currency);
  const months = new Map([] as [string, bigint][]);
  b?.links
    .filter((l) => l.valid)
    .forEach((l) => {
      const month = l.transaction?.occurred_on.slice(0, 7) ?? '';
      months.set(month, (months.get(month) ?? 0n) + BigInt(l.transaction?.amount_minor ?? 0));
    });
  return (
    <ScreenContainer>
      <AppHeader title={report ? 'Budget report' : (b?.name ?? 'Budget')} back />
      <FinanceNotice />
      <FinanceError message={state.error} onRetry={state.refresh} />
      <FinanceError message={action.error} />
      {state.loading && <FinanceLoading />}
      {!state.loading && !state.error && !b && (
        <AppText>Budget not found. Return to Budget Divider.</AppText>
      )}
      {b && (
        <>
          <AppText tone="muted">
            {b.starts_on} – {b.ends_on} · {b.archived ? 'Archived' : 'Active'} · inclusive local
            dates
          </AppText>
          <AppCard>
            <AppText variant="heading">Funding {money(b.funding_minor)}</AppText>
            <AppText>Allocated {money(b.allocated)}</AppText>
            <AppText>Unallocated {money(b.unallocated)}</AppText>
            <AppText>Linked expenses {money(b.spent)}</AppText>
            <AppText>Budget remaining {money(b.remaining)}</AppText>
            <AppText tone="muted">
              Current account balance {money(b.accountBalance)}. Allocations do not move or reserve
              bank money.
            </AppText>
          </AppCard>
          <AppText variant="label">Source balances at creation</AppText>
          {b.initialSources.map((source) => (
            <AppText key={source.id} tone="muted">
              {source.name}: {money(source.balanceMinor)}
            </AppText>
          ))}
          {!report && (
            <View style={styles.section}>
              <AppButton
                label="Edit budget / adjust funding"
                variant="secondary"
                onPress={() => router.push(`/budget/${id}/edit`)}
              />
              {!b.archived && (
                <AppButton
                  label="Add allocation"
                  onPress={() => router.push(`/budget/${id}/divide`)}
                />
              )}
              <AppButton
                label="Transaction history"
                variant="secondary"
                onPress={() => router.push(`/budget/${id}/history`)}
              />
              <AppButton
                label="Budget reports"
                variant="secondary"
                onPress={() => router.push(`/budget/${id}/reports`)}
              />
              <AppButton
                label={b.archived ? 'Restore budget' : 'Archive budget'}
                disabled={action.saving}
                variant="secondary"
                onPress={() =>
                  Alert.alert(
                    b.archived ? 'Restore budget?' : 'Archive budget?',
                    'History and funding scope are retained. Archived budgets still prevent overlapping funding periods.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: b.archived ? 'Restore' : 'Archive',
                        onPress: () =>
                          void action.run(
                            () => budgetService.edit(id, b.revision, b.name, !b.archived),
                            state.refresh,
                          ),
                      },
                    ],
                  )
                }
              />
            </View>
          )}
          <AppText variant="heading">Category allocations</AppText>
          {!b.categories.length && (
            <AppText tone="muted">No allocations. All funding is unallocated.</AppText>
          )}
          {b.categories.map((a) => (
            <AppCard
              key={a.id}
              onPress={() => router.push(`/budget/${id}/allocation/${a.id}`)}
              accessibilityLabel={`Open allocation ${a.category_name}`}
            >
              <AppText variant="label">{a.category_name}</AppText>
              <AppText>
                {a.mode === 'percent' ? `${a.value / 100}% of funding` : 'Fixed allocation'}
              </AppText>
              <AppText>
                Allocated {money(a.allocated)} · spent {money(a.spent)}
              </AppText>
              <View
                accessibilityLabel={`${percentage(a.spent, a.allocated)} percent spent`}
                style={{
                  backgroundColor: colors.lavender,
                  height: 8,
                  borderRadius: 4,
                }}
              >
                <View
                  style={{
                    backgroundColor: colors.primary,
                    height: 8,
                    borderRadius: 4,
                    width: `${Math.min(100, percentage(a.spent, a.allocated))}%`,
                  }}
                />
              </View>
              <AppText>
                {a.remaining < 0n ? 'Overspent' : 'Remaining'}{' '}
                {money(a.remaining < 0n ? -a.remaining : a.remaining)}
              </AppText>
            </AppCard>
          ))}
          {b.links.some((l) => !l.valid) && (
            <AppText>
              Some linked expenses changed category, account, type or date and are excluded. Review
              Transaction history to unlink them.
            </AppText>
          )}
          {report && (
            <>
              <AppText variant="heading">Monthly linked spending</AppText>
              {[...months]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, amount]) => (
                  <AppText key={month}>
                    {month}: {money(amount)}
                  </AppText>
                ))}
              {!months.size && <AppText>No linked spending in this period.</AppText>}
              <AppText tone="muted">
                Full-period allocations are not prorated. Custom periods use the dates recorded on
                the budget.
              </AppText>
              <AppText variant="heading">Funding audit</AppText>
              {b.fundingHistory.map((h) => (
                <AppCard key={h.id}>
                  <AppText>{h.reason}</AppText>
                  <AppText>
                    {money(h.previous_minor)} → {money(h.funding_minor)}
                  </AppText>
                  <AppText tone="muted">{h.created_at}</AppText>
                  {h.sources.map((source) => (
                    <AppText key={source.id} tone="muted">
                      {source.name}: {money(source.balanceMinor)}
                    </AppText>
                  ))}
                </AppCard>
              ))}
            </>
          )}
        </>
      )}
    </ScreenContainer>
  );
}
