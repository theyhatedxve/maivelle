import { useLocalSearchParams } from 'expo-router';
import BudgetHistory from '../../../features/budget/components/BudgetHistory.tsx';
export default function BudgetHistoryRoute() {
  const { id } = useLocalSearchParams();
  return <BudgetHistory id={typeof id === 'string' ? id : ''} />;
}
