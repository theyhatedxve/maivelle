import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, usePreventRemove } from 'expo-router';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { financeError, useFinanceAction } from '../hooks/useFinance.ts';
import { currencies, moneyInput } from '../services/money.ts';
import {
  FinanceNotice,
  FinanceField,
  FinanceChip,
  FinanceError,
  FinanceLoading,
} from './FinanceControls.tsx';
import { useFinanceStyles } from './financeStyles.ts';

export type AccountEditorProps = {
  id: string | null;
};

const blank = {
  name: '',
  type: 'cash',
  currency: 'PHP',
  opening: '0.00',
  archived: false,
};

export default function AccountEditor({ id }: AccountEditorProps) {
  const styles = useFinanceStyles();
  const { financeService: service } = useDatabase();
  const [record, setRecord] = useState(
    null as import('../../../database/repositories/financeRepository.ts').FinancialAccount | null,
  );
  const [form, setForm] = useState(blank);
  const [original, setOriginal] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const action = useFinanceAction();
  const dirty = loaded && JSON.stringify(form) !== JSON.stringify(original);
  const disable = usePreventRemove(!leaving && (dirty || action.saving), ({ repeat }) => {
    if (action.busy.current) return;
    Alert.alert('Discard account changes?', 'Unsaved changes will be lost.', [
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
        ? service.getAccount(id)
        : Promise.resolve(null)
    )
      .then((account) => {
        if (!active) return;
        if (id !== null && !account) {
          setNotFound(true);
          return;
        }
        const value = account
          ? {
              name: account.name,
              type: account.type,
              currency: account.currency,
              opening: moneyInput(account.opening_minor),
              archived: !!account.archived,
            }
          : blank;
        setRecord(account);
        setForm(value);
        setOriginal(value);
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
  }, [id, service, attempt]);
  function save() {
    const commit = () =>
      void action.run(
        () => service.saveAccount(id, record?.revision ?? null, form),
        () => {
          setLeaving(true);
          disable();
          router.dismissTo('/financial/accounts');
        },
      );
    if (record && form.opening !== original.opening) {
      Alert.alert(
        'Change opening balance?',
        'This recalculates the recorded account balance. It does not add income or change transaction history.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save opening balance', onPress: commit },
        ],
      );
    } else commit();
  }
  return (
    <ScreenContainer>
      <AppHeader
        title={id === null ? 'Create account' : 'Edit account'}
        subtitle="Fictional development accounts only"
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
      <FinanceError message={action.error} />
      {loading && <FinanceLoading />}
      {notFound && <AppText>Account not found. Return to Accounts.</AppText>}
      {loaded && (
        <View style={styles.section}>
          <FinanceField
            label="Account name"
            value={form.name}
            disabled={action.saving}
            onChange={(name) => setForm({ ...form, name })}
          />
          <AppText variant="label">Account type</AppText>
          <View style={styles.row}>
            {[
              { id: 'cash', label: 'Cash' },
              { id: 'bank', label: 'Bank' },
              { id: 'ewallet', label: 'E-Wallet' },
              { id: 'other', label: 'Other' },
            ].map((type) => (
              <FinanceChip
                key={type.id}
                label={type.label}
                selected={form.type === type.id}
                disabled={action.saving}
                onPress={() => setForm({ ...form, type: type.id })}
              />
            ))}
          </View>
          <AppText variant="label">Currency {record ? '(fixed after creation)' : ''}</AppText>
          <View style={styles.row}>
            {currencies.map((currency) => (
              <FinanceChip
                key={currency}
                label={currency}
                selected={form.currency === currency}
                disabled={action.saving || !!record}
                onPress={() => setForm({ ...form, currency })}
              />
            ))}
          </View>
          <FinanceField
            label="Opening balance"
            value={form.opening}
            disabled={action.saving}
            money
            signed
            onChange={(opening) => setForm({ ...form, opening })}
          />
          <AppText tone="muted">
            Use decimal text such as 1000.25, without commas. Zero and negative opening balances are
            allowed. Opening balances are separate from income.
          </AppText>
          <AppButton
            label={action.saving ? 'Saving…' : 'Save account'}
            disabled={action.saving}
            onPress={save}
          />
        </View>
      )}
    </ScreenContainer>
  );
}
