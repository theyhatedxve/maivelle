import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, usePreventRemove } from 'expo-router';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { financeError, useFinanceAction, useFinanceData } from '../hooks/useFinance.ts';
import { financialToday } from '../services/financeLedger.ts';
import { moneyInput } from '../services/money.ts';
import {
  AccountPicker,
  CategoryPicker,
  FinanceNotice,
  FinanceField,
  FinanceChip,
  FinanceError,
  FinanceLoading,
} from './FinanceControls.tsx';
import { useFinanceStyles } from './financeStyles.ts';

export type TransactionEditorProps = {
  id: string | null;
  initialType?: string;
};

export default function TransactionEditor({ id, initialType = 'expense' }: TransactionEditorProps) {
  const styles = useFinanceStyles();
  const { financeService: service } = useDatabase();
  const [submissionId] = useState(() => service.newTransactionId());
  const [record, setRecord] = useState(
    null as
      | import('../../../database/repositories/financeRepository.ts').FinancialTransaction
      | null,
  );
  const [form, setForm] = useState({
    type: ['income', 'expense', 'transfer'].includes(initialType) ? initialType : 'expense',
    amount: '',
    accountId: '',
    toAccountId: null,
    categoryId: null,
    description: '',
    date: '',
  } as import('../validation/financeInput.ts').TransactionInput);
  const [original, setOriginal] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const action = useFinanceAction();
  const choicesLoad = useCallback(
    async () => ({
      accounts: await service.accounts(),
      categories: await service.categories(),
    }),
    [service],
  );
  const choices = useFinanceData(choicesLoad);
  const dirty = loaded && JSON.stringify(form) !== original;
  const disable = usePreventRemove(!leaving && (dirty || action.saving), ({ repeat }) => {
    if (action.busy.current) return;
    Alert.alert('Discard transaction changes?', 'Your unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setLeaving(true);
          repeat();
        },
      },
    ]);
  });
  useEffect(() => {
    let active = true;
    (id === null
      ? Promise.resolve(null)
      : /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)
        ? service.getTransaction(id)
        : Promise.resolve(null)
    )
      .then((row) => {
        if (!active) return;
        if (id !== null && !row) {
          setNotFound(true);
          return;
        }
        const value = row
          ? {
              type: row.type,
              amount: moneyInput(row.amount_minor),
              accountId: row.account_id,
              toAccountId: row.to_account_id,
              categoryId: row.category_id,
              description: row.description,
              date: row.occurred_on,
            }
          : {
              type: ['expense', 'income', 'transfer'].includes(initialType)
                ? initialType
                : 'expense',
              amount: '',
              accountId: '',
              toAccountId: null,
              categoryId: null,
              description: '',
              date: financialToday(),
            };
        setRecord(row);
        setForm(value);
        setOriginal(JSON.stringify(value));
        setLoaded(true);
        setError('');
      })
      .catch((failure) => {
        if (active) setError(financeError(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, initialType, service, attempt]);
  function leave() {
    setLeaving(true);
    disable();
    router.dismissTo('/financial/history');
  }
  function save() {
    void action.run(
      () => service.saveTransaction(id, record?.revision ?? null, submissionId, form),
      leave,
    );
  }
  function remove() {
    if (!record || action.saving) return;
    const row = record;
    Alert.alert(
      'Delete transaction?',
      row.type === 'transfer'
        ? 'Both sides of this transfer will be removed from calculated balances.'
        : 'This transaction will be removed and its account balance recalculated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void action.run(() => service.deleteTransaction(row), leave),
        },
      ],
    );
  }
  const transfer = form.type === 'transfer';
  const retainedIds = record ? [record.account_id, record.to_account_id ?? ''] : [];
  const source = choices.data?.accounts.find((a) => a.id === form.accountId);
  return (
    <ScreenContainer>
      <AppHeader
        title={id !== null ? 'Edit transaction' : transfer ? 'Transfer money' : 'Add transaction'}
        subtitle="Fictional financial records only"
        back
      />
      <FinanceNotice />
      <FinanceError
        message={error}
        onRetry={
          !loaded
            ? () => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }
            : undefined
        }
      />
      <FinanceError message={choices.error} onRetry={choices.refresh} />
      <FinanceError message={action.error} />
      {(loading || choices.loading) && <FinanceLoading />}
      {notFound && <AppText>Transaction not found. Return to History.</AppText>}
      {loaded && choices.data && (
        <View style={styles.section}>
          {!transfer && (
            <View style={styles.row}>
              {['expense', 'income'].map((type) => (
                <FinanceChip
                  key={type}
                  label={type === 'income' ? 'Income' : 'Expense'}
                  selected={form.type === type}
                  disabled={action.saving}
                  onPress={() => setForm({ ...form, type, categoryId: null })}
                />
              ))}
            </View>
          )}
          <AccountPicker
            label={transfer ? 'From account' : 'Account'}
            accounts={choices.data.accounts}
            value={form.accountId}
            onChange={(accountId) => setForm({ ...form, accountId })}
            retainedIds={retainedIds}
            disabled={action.saving}
          />
          {transfer && (
            <AccountPicker
              label="To account"
              accounts={choices.data.accounts}
              value={form.toAccountId ?? ''}
              onChange={(toAccountId) => setForm({ ...form, toAccountId })}
              retainedIds={retainedIds}
              disabled={action.saving}
            />
          )}
          <AppText variant="label">Currency: {source?.currency ?? 'Select an account'}</AppText>
          {transfer && (
            <AppText tone="muted">
              Transfers require different accounts with matching currencies. No currency conversion
              or fees are added. A transfer is not income or expense.
            </AppText>
          )}
          <FinanceField
            label="Amount"
            value={form.amount}
            money
            disabled={action.saving}
            onChange={(amount) => setForm({ ...form, amount })}
          />
          <FinanceField
            label="Transaction date (YYYY-MM-DD)"
            value={form.date}
            disabled={action.saving}
            onChange={(date) => setForm({ ...form, date })}
          />
          {!transfer && (
            <CategoryPicker
              categories={choices.data.categories}
              kind={form.type}
              value={form.categoryId}
              onChange={(categoryId) => setForm({ ...form, categoryId })}
              disabled={action.saving}
            />
          )}
          {!!record?.category_key && !record.category_id && !form.categoryId && (
            <AppText tone="muted">
              The former category was deleted. Saving this edit assigns Uncategorized unless you
              select another category.
            </AppText>
          )}
          <FinanceField
            label="Description"
            value={form.description}
            multiline
            disabled={action.saving}
            onChange={(description) => setForm({ ...form, description })}
          />
          <AppText tone="muted">
            Positive amounts only, up to two decimals. Negative balances are allowed; this records
            your entries without checking bank funds.
          </AppText>
          <AppButton
            label={action.saving ? 'Saving…' : transfer ? 'Save transfer' : 'Save transaction'}
            disabled={action.saving || !!choices.error}
            onPress={save}
          />
          {record && (
            <AppButton
              label="Delete transaction"
              variant="secondary"
              disabled={action.saving}
              onPress={remove}
            />
          )}
          <View style={styles.row}>
            <AppButton
              label="Manage accounts"
              variant="secondary"
              disabled={action.saving}
              onPress={() => router.push('/financial/accounts')}
            />
            {!transfer && (
              <AppButton
                label="Manage categories"
                variant="secondary"
                disabled={action.saving}
                onPress={() => router.push('/financial/categories')}
              />
            )}
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
