import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, usePreventRemove } from 'expo-router';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { financeError, useFinanceAction } from '../../finance/hooks/useFinance.ts';
import {
  FinanceChip,
  FinanceField,
  FinanceError,
  FinanceLoading,
  FinanceNotice,
} from '../../finance/components/FinanceControls.tsx';
import { useFinanceStyles } from '../../finance/components/financeStyles.ts';
import { currencies, moneyInput, formatMoney } from '../../finance/services/money.ts';
import {
  financialToday,
  ledgerBalances,
  monthBounds,
} from '../../finance/services/financeLedger.ts';

export type BudgetEditorProps = {
  id?: string;
  allocationId?: string;
  divide?: boolean;
};

export type Overview = Awaited<
  ReturnType<
    ReturnType<typeof import('../services/budgetService.ts').createBudgetService>['overview']
  >
>;

export default function BudgetEditor({ id, allocationId, divide = false }: BudgetEditorProps) {
  const styles = useFinanceStyles();
  const { budgetService: service } = useDatabase();
  const [data, setData] = useState(null as Overview | null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [initial] = useState(() => {
    const today = financialToday();
    const { from, to } = monthBounds(today.slice(0, 7));
    const end = new Date(`${to}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 1);
    return {
      name: '',
      currency: 'PHP',
      from,
      to: end.toISOString().slice(0, 10),
      accountIds: [] as string[],
      funding: '0.00',
      reason: '',
      categoryKey: 'uncategorized',
      mode: 'fixed',
      value: '0.00',
    };
  });
  const [form, setForm] = useState(initial);
  const [original, setOriginal] = useState('');
  const [leaving, setLeaving] = useState(false);
  const action = useFinanceAction();
  const dirty = !!original && JSON.stringify(form) !== original;
  const disable = usePreventRemove(!leaving && (dirty || action.saving), ({ repeat }) => {
    if (action.busy.current) return;
    Alert.alert('Discard budget changes?', 'Unsaved changes will be lost.', [
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
    service
      .overview()
      .then((value) => {
        if (!active) return;
        const b = value.reports.find((b) => b.id === id);
        const allocation = b?.categories.find((a) => a.id === allocationId);
        setData(value);
        setError('');
        const next = {
          ...initial,
          ...(b
            ? {
                name: b.name,
                currency: b.currency,
                from: b.starts_on,
                to: b.ends_on,
                accountIds: b.scope,
                funding: moneyInput(b.funding_minor),
              }
            : {}),
          ...(allocation
            ? {
                categoryKey: allocation.category_key,
                mode: allocation.mode,
                value: moneyInput(allocation.value),
              }
            : {}),
        };
        setForm(next);
        setOriginal(JSON.stringify(next));
      })
      .catch((failure) => {
        if (active) setError(financeError(failure));
      });
    return () => {
      active = false;
    };
  }, [id, allocationId, service, attempt, initial]);
  const b = data?.reports.find((b) => b.id === id);
  const allocation = b?.categories.find((a) => a.id === allocationId);
  const missing = !!data && ((!!id && !b) || (!!allocationId && !allocation));
  const balances = data
    ? ledgerBalances(data.model.finance.accounts, data.model.finance.transactions)
    : [];
  const selected = balances
    .filter((a) => form.accountIds.includes(a.id))
    .reduce((sum, a) => sum + a.balanceMinor, 0n);
  const exit = () => {
    setLeaving(true);
    disable();
    router.dismissTo(id ? `/budget/${id}` : '/budget');
  };
  function save() {
    if (divide && b)
      void action.run(
        () =>
          service.saveAllocation(b.id, b.revision, {
            id: allocationId ?? null,
            categoryKey: form.categoryKey,
            mode: form.mode,
            value: form.value,
          }),
        exit,
      );
    else if (b)
      void action.run(() => service.edit(b.id, b.revision, form.name, !!b.archived), exit);
    else
      void action.run(async () => {
        const created = await service.create(form);
        setLeaving(true);
        disable();
        router.dismissTo(`/budget/${created}`);
      });
  }
  return (
    <ScreenContainer>
      <AppHeader title={divide ? 'Budget allocation' : id ? 'Edit budget' : 'Create budget'} back />
      <FinanceNotice />
      <FinanceError message={error} onRetry={() => setAttempt((n) => n + 1)} />
      <FinanceError message={action.error} />
      {!data && !error && <FinanceLoading />}
      {missing && <AppText>Budget or allocation not found.</AppText>}
      {data && !missing && (
        <View style={styles.section}>
          {divide ? (
            <>
              <AppText>
                Funding {formatMoney(b?.funding_minor ?? 0, b?.currency)}. Percentage values use up
                to two decimal places. Zero allocations are allowed.
              </AppText>
              <AppText variant="label">Expense category</AppText>
              <View style={styles.row}>
                {[
                  { id: 'uncategorized', name: 'Uncategorized' },
                  ...data.model.categories,
                  ...(allocation &&
                  !data.model.categories.some((c) => c.id === allocation.category_key) &&
                  allocation.category_key !== 'uncategorized'
                    ? [
                        {
                          id: allocation.category_key,
                          name: allocation.category_name,
                        },
                      ]
                    : []),
                ].map((c) => (
                  <FinanceChip
                    key={c.id}
                    label={c.name}
                    selected={form.categoryKey === c.id}
                    disabled={!!allocationId || action.saving}
                    onPress={() => setForm({ ...form, categoryKey: c.id })}
                  />
                ))}
              </View>
              <AppButton
                label="Manage Finance expense categories"
                variant="secondary"
                disabled={dirty || action.saving}
                onPress={() => router.push('/financial/categories')}
              />
              <AppText tone="muted">
                Create expense categories in Finance. Reopen this form after category changes.
                Category identity is fixed after allocation creation.
              </AppText>
              <View style={styles.row}>
                {['fixed', 'percent'].map((mode) => (
                  <FinanceChip
                    key={mode}
                    label={mode === 'fixed' ? 'Fixed amount' : 'Percentage'}
                    selected={form.mode === mode}
                    disabled={action.saving}
                    onPress={() => setForm({ ...form, mode })}
                  />
                ))}
              </View>
              <FinanceField
                label={form.mode === 'fixed' ? 'Allocation amount' : 'Allocation percentage'}
                value={form.value}
                money
                disabled={action.saving}
                onChange={(value) => setForm({ ...form, value })}
              />
            </>
          ) : (
            <>
              <FinanceField
                label="Budget name"
                value={form.name}
                disabled={action.saving}
                onChange={(name) => setForm({ ...form, name })}
              />
              {!id ? (
                <>
                  <AppText variant="label">Currency</AppText>
                  <View style={styles.row}>
                    {currencies.map((currency) => (
                      <FinanceChip
                        key={currency}
                        label={currency}
                        selected={form.currency === currency}
                        disabled={action.saving}
                        onPress={() => setForm({ ...form, currency, accountIds: [] })}
                      />
                    ))}
                  </View>
                  <FinanceField
                    label="Period start (YYYY-MM-DD)"
                    value={form.from}
                    disabled={action.saving}
                    onChange={(from) => setForm({ ...form, from })}
                  />
                  <FinanceField
                    label="Period end (YYYY-MM-DD)"
                    value={form.to}
                    disabled={action.saving}
                    onChange={(to) => setForm({ ...form, to })}
                  />
                  <AppText variant="label">Funding accounts (select one or more)</AppText>
                  <View style={styles.row}>
                    {balances
                      .filter((a) => !a.archived && a.currency === form.currency)
                      .map((a) => (
                        <FinanceChip
                          key={a.id}
                          label={`${a.name} · ${formatMoney(a.balanceMinor, a.currency)}`}
                          accessibilityLabel={`Funding account: ${a.name}`}
                          selected={form.accountIds.includes(a.id)}
                          disabled={action.saving}
                          onPress={() =>
                            setForm({
                              ...form,
                              accountIds: form.accountIds.includes(a.id)
                                ? form.accountIds.filter((v) => v !== a.id)
                                : [...form.accountIds, a.id],
                            })
                          }
                        />
                      ))}
                  </View>
                  <AppText>Current selected balance {formatMoney(selected, form.currency)}</AppText>
                  <AppButton
                    label="Manage Finance accounts"
                    variant="secondary"
                    disabled={dirty || action.saving}
                    onPress={() => router.push('/financial/accounts')}
                  />
                  <AppText tone="muted">
                    Select a fixed amount up to the current combined balance. This captures balances
                    now, not at the period start. Scope, currency and period cannot change after
                    creation. Archived budgets continue to reserve their scope and period.
                  </AppText>
                  <FinanceField
                    label="Funding snapshot amount"
                    value={form.funding}
                    money
                    disabled={action.saving}
                    onChange={(funding) => setForm({ ...form, funding })}
                  />
                </>
              ) : (
                <AppText tone="muted">
                  Scope, currency and dates are fixed. Use a different period for a new budget.
                  Renaming does not change funding.
                </AppText>
              )}
            </>
          )}
          <AppButton
            label={
              action.saving
                ? 'Saving…'
                : divide
                  ? 'Save allocation'
                  : id
                    ? 'Save budget name'
                    : 'Save budget'
            }
            disabled={action.saving || (!!b?.archived && divide)}
            onPress={save}
          />
          {id && !divide && b && !b.archived && (
            <>
              <AppText variant="heading">Explicit funding adjustment</AppText>
              <AppText>
                Current funding {formatMoney(b.funding_minor, b.currency)}. Increases must fit
                current source balances; decreases must still cover allocations. Percentage
                allocations will recalculate.
              </AppText>
              <FinanceField
                label="New total funding"
                value={form.funding}
                money
                disabled={action.saving}
                onChange={(funding) => setForm({ ...form, funding })}
              />
              <FinanceField
                label="Adjustment reason"
                value={form.reason}
                disabled={action.saving}
                onChange={(reason) => setForm({ ...form, reason })}
              />
              <AppButton
                label="Adjust funding"
                disabled={action.saving}
                variant="secondary"
                onPress={() =>
                  Alert.alert(
                    'Adjust budget funding?',
                    'The original snapshot is retained. This records a funding adjustment and recalculates percentage allocations. Unsaved name changes are not saved.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Adjust funding',
                        onPress: () =>
                          void action.run(
                            () =>
                              service.adjustFunding(b.id, b.revision, form.funding, form.reason),
                            exit,
                          ),
                      },
                    ],
                  )
                }
              />
            </>
          )}
        </View>
      )}
    </ScreenContainer>
  );
}
