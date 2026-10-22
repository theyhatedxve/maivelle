import { useCallback, useRef, useState } from 'react';
import { AppState, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Receipt } from 'lucide-react-native';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import EmptyState from '../../../components/ui/EmptyState.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { financeError, useFinanceData } from '../hooks/useFinance.ts';
import { financeDate } from '../validation/financeInput.ts';
import {
  AccountPicker,
  CategoryPicker,
  FinanceNotice,
  FinanceField,
  FinanceChip,
  FinanceError,
  FinanceLoading,
} from './FinanceControls.tsx';
import TransactionCard from './TransactionCard.tsx';
import { useFinanceStyles } from './financeStyles.ts';

export type TransactionHistoryProps = {
  initialAccountId?: string;
};

export default function TransactionHistory({ initialAccountId = '' }: TransactionHistoryProps) {
  const styles = useFinanceStyles();
  const { financeService: service } = useDatabase();
  const [search, setSearch] = useState('');
  const [accountId, setAccountId] = useState(initialAccountId);
  const [categoryId, setCategoryId] = useState(null as string | null);
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('newest');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({
    accountId: initialAccountId || undefined,
  } as import('../../../database/repositories/financeRepository.ts').FinanceQuery);
  const [rows, setRows] = useState(
    [] as import('../../../database/repositories/financeRepository.ts').FinancialTransaction[],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const sequence = useRef(0);
  const busy = useRef(false);
  const choicesLoad = useCallback(
    async () => ({
      accounts: await service.accounts(),
      categories: await service.categories(),
    }),
    [service],
  );
  const choices = useFinanceData(choicesLoad);
  const load = useCallback(
    async (offset = 0) => {
      if (offset && busy.current) return;
      const request = offset ? sequence.current : ++sequence.current;
      busy.current = true;
      setLoading(true);
      try {
        const records = await service.history({
          ...applied,
          offset,
          limit: 50,
        });
        if (request === sequence.current) {
          setRows((old) =>
            offset
              ? [...old, ...records.filter((row) => !old.some((entry) => entry.id === row.id))]
              : records,
          );
          setMore(records.length === 50);
          setError('');
        }
      } catch (failure) {
        if (request === sequence.current) {
          setError(financeError(failure));
          setMore(false);
        }
      } finally {
        if (request === sequence.current) {
          setLoading(false);
          busy.current = false;
        }
      }
    },
    [service, applied],
  );
  useFocusEffect(
    useCallback(() => {
      const first = setTimeout(() => void load(), 0);
      const unsubscribe = service.subscribe(() => void load());
      const foreground = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
      });
      return () => {
        clearTimeout(first);
        unsubscribe();
        foreground.remove();
        sequence.current++;
        busy.current = false;
      };
    }, [service, load]),
  );
  function apply() {
    try {
      const start = from ? financeDate(from) : undefined;
      const end = to ? financeDate(to) : undefined;
      if (start && end && start > end) throw new Error('Range end must be on or after start.');
      setApplied({
        search,
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
        type,
        sort,
        from: start,
        to: end,
      });
    } catch (failure) {
      setError(financeError(failure));
    }
  }
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={loading && rows.length > 0}
        onRefresh={() => void load()}
        onEndReached={() => {
          if (more && !error) void load(rows.length);
        }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={styles.section}>
            <AppHeader title="Transaction history" subtitle="Search all local entries" back />
            <FinanceNotice />
            <AppButton
              label="Add transaction"
              onPress={() => router.push('/financial/transaction/new')}
            />
            <FinanceField
              label="Search descriptions, accounts or categories"
              value={search}
              onChange={setSearch}
            />
            <AccountPicker
              accounts={choices.data?.accounts ?? []}
              value={accountId}
              onChange={setAccountId}
              filter
            />
            <View style={styles.row}>
              {['all', 'expense', 'income', 'transfer'].map((value) => (
                <FinanceChip
                  key={value}
                  label={value === 'all' ? 'All types' : value[0].toUpperCase() + value.slice(1)}
                  selected={type === value}
                  onPress={() => {
                    setType(value);
                    setCategoryId(null);
                  }}
                />
              ))}
            </View>
            {type !== 'transfer' && (
              <CategoryPicker
                categories={choices.data?.categories ?? []}
                value={categoryId}
                onChange={setCategoryId}
                kind={type}
                filter
              />
            )}
            <FinanceField
              label="From date (YYYY-MM-DD, optional)"
              value={from}
              onChange={setFrom}
            />
            <FinanceField label="Through date (YYYY-MM-DD, optional)" value={to} onChange={setTo} />
            <View style={styles.row}>
              {[
                { id: 'newest', label: 'Newest first' },
                { id: 'oldest', label: 'Oldest first' },
                { id: 'largest', label: 'Largest amount' },
              ].map((option) => (
                <FinanceChip
                  key={option.id}
                  label={option.label}
                  selected={sort === option.id}
                  onPress={() => setSort(option.id)}
                />
              ))}
            </View>
            <AppText tone="muted">
              Largest amount sorts raw minor units; amounts in different currencies are not
              converted.
            </AppText>
            <AppButton label="Apply filters" variant="secondary" onPress={apply} />
            <FinanceError message={error} onRetry={() => void load()} />
            <FinanceError message={choices.error} onRetry={choices.refresh} />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.section}>
            <TransactionCard record={item} />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <FinanceLoading />
          ) : !error ? (
            <EmptyState
              icon={Receipt}
              title="No transactions"
              description="Add a fictional transaction or change these filters."
            />
          ) : undefined
        }
        ListFooterComponent={loading && rows.length ? <FinanceLoading /> : undefined}
      />
    </SafeAreaView>
  );
}
