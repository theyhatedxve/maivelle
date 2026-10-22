import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { usePreventRemove } from 'expo-router';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { useFinanceAction, useFinanceData } from '../hooks/useFinance.ts';
import {
  FinanceNotice,
  FinanceField,
  FinanceChip,
  FinanceError,
  FinanceLoading,
} from './FinanceControls.tsx';
import { useFinanceStyles } from './financeStyles.ts';
const blank = { name: '', kind: 'expense', color: '#6D42C7' };
export default function FinancialCategories() {
  const styles = useFinanceStyles();
  const { financeService: service } = useDatabase();
  const load = useCallback(() => service.categories(), [service]);
  const state = useFinanceData(load);
  const action = useFinanceAction();
  const [record, setRecord] = useState(
    null as import('../../../database/repositories/financeRepository.ts').FinancialCategory | null,
  );
  const [form, setForm] = useState(blank);
  const [original, setOriginal] = useState(blank);
  const [leaving, setLeaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(original);
  usePreventRemove(!leaving && (dirty || action.saving), ({ repeat }) => {
    if (action.busy.current) return;
    Alert.alert('Discard category changes?', 'Unsaved changes will be lost.', [
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
  function reset() {
    setRecord(null);
    setForm(blank);
    setOriginal(blank);
  }
  function replace(operation: () => void) {
    if (action.saving) return;
    if (!dirty) {
      operation();
      return;
    }
    Alert.alert('Discard category changes?', 'Unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: operation },
    ]);
  }
  return (
    <ScreenContainer>
      <AppHeader
        title="Transaction categories"
        subtitle="Separate income and expense categories"
        back
      />
      <FinanceNotice />
      <FinanceError message={state.error} onRetry={state.refresh} />
      <FinanceError message={action.error} />
      {state.loading && <FinanceLoading />}
      <View style={styles.section}>
        <AppText variant="title">{record ? 'Edit category' : 'New category'}</AppText>
        <FinanceField
          label="Category name"
          value={form.name}
          disabled={action.saving}
          onChange={(name) => setForm({ ...form, name })}
        />
        <View style={styles.row}>
          {['expense', 'income'].map((kind) => (
            <FinanceChip
              key={kind}
              label={kind === 'expense' ? 'Expense category' : 'Income category'}
              selected={form.kind === kind}
              disabled={action.saving || !!record}
              onPress={() => setForm({ ...form, kind })}
            />
          ))}
        </View>
        <FinanceField
          label="Category color (#RRGGBB)"
          value={form.color}
          disabled={action.saving}
          onChange={(color) => setForm({ ...form, color })}
        />
        <AppButton
          label={action.saving ? 'Saving…' : 'Save category'}
          disabled={action.saving || state.loading || !!state.error}
          onPress={() =>
            void action.run(
              () => service.saveCategory(record?.id ?? null, record?.revision ?? null, form),
              reset,
            )
          }
        />
        {record && (
          <AppButton
            label="New category instead"
            variant="secondary"
            disabled={action.saving}
            onPress={() => replace(reset)}
          />
        )}
      </View>
      {!state.loading && !state.data?.length && (
        <AppText tone="muted">No categories yet. Uncategorized transactions are allowed.</AppText>
      )}
      {state.data?.map((category) => (
        <View key={category.id} style={styles.section}>
          <AppCard>
            <View style={styles.row}>
              <View style={[styles.color, { backgroundColor: category.color }]} />
              <AppText variant="title">{category.name}</AppText>
            </View>
            <AppText>{category.kind}</AppText>
            <View style={styles.row}>
              <AppButton
                label={`Edit category ${category.name}`}
                variant="secondary"
                disabled={action.saving}
                onPress={() =>
                  replace(() => {
                    const value = {
                      name: category.name,
                      kind: category.kind,
                      color: category.color,
                    };
                    setRecord(category);
                    setForm(value);
                    setOriginal(value);
                  })
                }
              />
              <AppButton
                label={`Delete category ${category.name}`}
                variant="secondary"
                disabled={action.saving}
                onPress={() =>
                  replace(() =>
                    Alert.alert(
                      'Delete category?',
                      'Transactions keep their amounts, history and former category snapshot. No money is deleted.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () =>
                            void action.run(() => service.deleteCategory(category), reset),
                        },
                      ],
                    ),
                  )
                }
              />
            </View>
          </AppCard>
        </View>
      ))}
    </ScreenContainer>
  );
}
