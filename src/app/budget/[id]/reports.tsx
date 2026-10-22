import { useLocalSearchParams } from 'expo-router';
import BudgetDetails from '../../../features/budget/components/BudgetDetails.tsx';
export default function BudgetReportsRoute() {
  const { id } = useLocalSearchParams();
  return <BudgetDetails report id={typeof id === 'string' ? id : ''} />;
}
