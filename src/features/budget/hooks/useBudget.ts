import { useCallback } from 'react';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { useFinanceData } from '../../finance/hooks/useFinance.ts';
import { useFocusEffect } from 'expo-router';
export function useBudgets() {
  const { budgetService } = useDatabase();
  const load = useCallback(() => budgetService.overview(), [budgetService]);
  const state = useFinanceData(load);
  useFocusEffect(
    useCallback(() => budgetService.subscribe(state.refresh), [budgetService, state.refresh]),
  );
  return state;
}
