import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Receipt } from 'lucide-react-native';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import EmptyState from '../../../components/ui/EmptyState.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { useFinanceAction } from '../../finance/hooks/useFinance.ts';
import {
  FinanceError,
  FinanceLoading,
  FinanceNotice,
} from '../../finance/components/FinanceControls.tsx';
import { useFinanceStyles } from '../../finance/components/financeStyles.ts';
import { formatMoney } from '../../finance/services/money.ts';
import { eligibleExpense } from '../services/budgetMath.ts';
import { useBudgets } from '../hooks/useBudget.ts';

export type BudgetHistoryProps = {
  id: string;
  allocationId?: string;
};

export default function BudgetHistory({ id, allocationId }: BudgetHistoryProps) {
  const styles = useFinanceStyles();
  const state = useBudgets();
  const action = useFinanceAction();
  const { budgetService } = useDatabase();
  const b = state.data?.reports.find((b) => b.id === id);
  const allocation = b?.categories.find((a) => a.id === allocationId);
  const rows =
    state.data?.model.finance.transactions.filter(
      (t) =>
        b &&
        (allocation
          ? eligibleExpense(b, b.scope, t, allocation.category_key) ||
            b.links.some((l) => l.transaction_id === t.id && l.allocation_id === allocation.id)
          : b.links.some((l) => l.transaction_id === t.id)),
    ) ?? [];
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          <View style={styles.section}>
            <AppHeader title={allocation?.category_name ?? 'Budget transaction history'} back />
            <FinanceNotice />
            <FinanceError message={state.error} onRetry={state.refresh} />
            <FinanceError message={action.error} />
            {state.loading && <FinanceLoading />}
            {!state.loading && !state.error && (!b || (allocationId && !allocation)) && (
              <AppText>Budget or allocation not found.</AppText>
            )}
            {b && (
              <>
                <AppText>
                  {b.starts_on} – {b.ends_on} · {b.archived ? 'Archived · read only' : 'Active'}
                </AppText>
                {allocation && (
                  <>
                    <AppText>
                      Allocated {formatMoney(allocation.allocated, b.currency)} · spent{' '}
                      {formatMoney(allocation.spent, b.currency)}
                    </AppText>
                    <AppText>Remaining {formatMoney(allocation.remaining, b.currency)}</AppText>
                    {!b.archived && (
                      <AppButton
                        label="Edit allocation"
                        variant="secondary"
                        onPress={() =>
                          router.push({
                            pathname: '/budget/[id]/divide',
                            params: { id, allocationId },
                          })
                        }
                      />
                    )}
                  </>
                )}
                <AppText tone="muted">
                  {allocation
                    ? 'Eligible expenses and this allocation’s existing links. Link spending explicitly; Finance remains the source of truth.'
                    : 'Linked expenses only. Changed expenses outside the category, scope or period are excluded from spending until corrected or unlinked.'}
                </AppText>
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          !state.loading && b ? (
            <EmptyState
              icon={Receipt}
              title="No expenses here"
              description="Record a fictional expense in Finance using this budget’s category, account and date range. Then open its allocation to link it."
            />
          ) : undefined
        }
        renderItem={({ item: t }) => {
          const link = b?.links.find((l) => l.transaction_id === t.id);
          const ownLink = !!link && (!allocation || link.allocation_id === allocation.id);
          return (
            <AppCard>
              <AppText variant="label">{t.description || t.category_label}</AppText>
              <AppText>
                {formatMoney(t.amount_minor, t.currency)} · {t.occurred_on}
              </AppText>
              <AppText tone="muted">
                {t.account_name} · {t.category_label}
              </AppText>
              <AppText>
                {link
                  ? link.valid
                    ? 'Linked expense'
                    : 'Linked · excluded after Finance change'
                  : 'Not linked'}
              </AppText>
              <AppButton
                label="Open Finance transaction"
                variant="secondary"
                onPress={() => router.push(`/financial/transaction/${t.id}`)}
              />
              {b && !b.archived && (
                <AppButton
                  label={
                    ownLink
                      ? 'Unlink expense'
                      : link
                        ? 'Linked to another allocation'
                        : 'Link expense'
                  }
                  disabled={action.saving || (!!link && !ownLink)}
                  variant="secondary"
                  onPress={() =>
                    void action.run(
                      () =>
                        budgetService.setLink(
                          b.id,
                          b.revision,
                          ownLink ? link.allocation_id : (allocation?.id ?? ''),
                          t.id,
                          !ownLink,
                        ),
                      state.refresh,
                    )
                  }
                />
              )}
            </AppCard>
          );
        }}
      />
    </SafeAreaView>
  );
}
