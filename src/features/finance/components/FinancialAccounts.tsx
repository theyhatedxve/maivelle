import { useCallback, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, Wallet } from 'lucide-react-native';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import EmptyState from '../../../components/ui/EmptyState.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { useFinanceData, useFinanceAction } from '../hooks/useFinance.ts';
import { formatMoney } from '../services/money.ts';
import { FinanceNotice, FinanceError, FinanceLoading, FinanceChip } from './FinanceControls.tsx';
import { useFinanceStyles } from './financeStyles.ts';
export default function FinancialAccounts() {
  const styles = useFinanceStyles();
  const { financeService: service } = useDatabase();
  const load = useCallback(() => service.report(), [service]);
  const state = useFinanceData(load);
  const action = useFinanceAction();
  const [filter, setFilter] = useState('active');
  const accounts = (state.data?.accounts ?? []).filter(
    (account) =>
      filter === 'all' || (filter === 'archived' ? !!account.archived : !account.archived),
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        data={accounts}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.content}
        refreshing={state.loading && accounts.length > 0}
        onRefresh={state.refresh}
        ListHeaderComponent={
          <View style={styles.section}>
            <AppHeader title="Financial accounts" subtitle="Balances from your local ledger" back />
            <FinanceNotice />
            <AppButton
              label="Create account"
              icon={Plus}
              onPress={() => router.push('/financial/account/new')}
            />
            <View style={styles.row}>
              {['active', 'archived', 'all'].map((value) => (
                <FinanceChip
                  key={value}
                  label={`${value[0].toUpperCase()}${value.slice(1)} accounts`}
                  selected={filter === value}
                  onPress={() => setFilter(value)}
                />
              ))}
            </View>
            <FinanceError message={state.error} onRetry={state.refresh} />
            <FinanceError message={action.error} />
            <AppText tone="muted">
              Negative balances are allowed and shown explicitly. Archived accounts retain balances
              and history, but cannot receive new entries.
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.section}>
            <AppCard>
              <AppText variant="title">{item.name}</AppText>
              <AppText tone="muted">
                {item.type.toUpperCase()} · {item.currency} ·{' '}
                {item.archived ? 'Archived' : 'Active'}
              </AppText>
              <AppText variant="title" tone="primary">
                {formatMoney(item.balanceMinor, item.currency)}
              </AppText>
              {item.balanceMinor < 0n && <AppText>Negative recorded balance</AppText>}
              <AppText variant="caption" tone="muted">
                Opening: {formatMoney(item.opening_minor, item.currency)}
              </AppText>
              <View style={styles.row}>
                <AppButton
                  label={`Edit account ${item.name}`}
                  disabled={action.saving}
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/financial/account/[id]',
                      params: { id: item.id },
                    })
                  }
                />
                <AppButton
                  label={`History for ${item.name}`}
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/financial/history',
                      params: { accountId: item.id },
                    })
                  }
                />
                <AppButton
                  label={item.archived ? 'Restore account' : 'Archive account'}
                  disabled={action.saving}
                  variant="secondary"
                  onPress={() =>
                    Alert.alert(
                      item.archived ? 'Restore account?' : 'Archive account?',
                      'All transactions and balances remain in history and reports.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: item.archived ? 'Restore' : 'Archive',
                          onPress: () =>
                            void action.run(() => service.archiveAccount(item, !item.archived)),
                        },
                      ],
                    )
                  }
                />
              </View>
            </AppCard>
          </View>
        )}
        ListEmptyComponent={
          state.loading ? (
            <FinanceLoading />
          ) : !state.error ? (
            <EmptyState
              icon={Wallet}
              title="No accounts here"
              description="Create a fictional account or choose another archive filter."
            />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}
