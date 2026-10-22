import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, PieChart } from 'lucide-react-native';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import EmptyState from '../../../components/ui/EmptyState.tsx';
import {
  FinanceChip,
  FinanceError,
  FinanceLoading,
  FinanceNotice,
} from '../../finance/components/FinanceControls.tsx';
import { useFinanceStyles } from '../../finance/components/financeStyles.ts';
import { formatMoney } from '../../finance/services/money.ts';
import { useBudgets } from '../hooks/useBudget.ts';
export default function BudgetOverview() {
  const styles = useFinanceStyles();
  const state = useBudgets();
  const [archived, setArchived] = useState(false);
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.content}
        data={state.data?.reports.filter((b) => !!b.archived === archived) ?? []}
        keyExtractor={(b) => b.id}
        ListHeaderComponent={
          <View style={styles.section}>
            <AppHeader
              title="Budget Divider"
              subtitle="Plan existing money. Track linked spending."
              back
            />
            <FinanceNotice />
            <AppButton
              label="Create budget"
              icon={Plus}
              onPress={() => router.push('/budget/new')}
            />
            <View style={styles.row}>
              {[false, true].map((value) => (
                <FinanceChip
                  key={String(value)}
                  label={value ? 'Archived budgets' : 'Active budgets'}
                  selected={archived === value}
                  onPress={() => setArchived(value)}
                />
              ))}
            </View>
            <FinanceError message={state.error} onRetry={state.refresh} />
            {state.loading && <FinanceLoading />}
          </View>
        }
        ListEmptyComponent={
          !state.loading && !state.error ? (
            <EmptyState
              icon={PieChart}
              title="No budgets yet"
              description="Create a fictional funded budget, divide it into expense categories, then link existing expenses."
            />
          ) : undefined
        }
        renderItem={({ item: b }) => (
          <AppCard
            onPress={() => router.push(`/budget/${b.id}`)}
            accessibilityLabel={`Open budget ${b.name}`}
          >
            <AppText variant="heading">{b.name}</AppText>
            <AppText tone="muted">
              {b.starts_on} – {b.ends_on} · {b.currency}
            </AppText>
            <AppText>Funding {formatMoney(b.funding_minor, b.currency)}</AppText>
            <AppText>
              Allocated {formatMoney(b.allocated, b.currency)} · spent{' '}
              {formatMoney(b.spent, b.currency)}
            </AppText>
            <AppText>Unallocated {formatMoney(b.unallocated, b.currency)}</AppText>
            <AppText tone="muted">
              Budget remaining {formatMoney(b.remaining, b.currency)} · account balance is separate
            </AppText>
          </AppCard>
        )}
      />
    </SafeAreaView>
  );
}
