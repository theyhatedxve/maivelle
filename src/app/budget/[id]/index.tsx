import { useLocalSearchParams } from 'expo-router';
import BudgetDetails from '../../../features/budget/components/BudgetDetails.tsx';
export default function BudgetRoute() {
  const { id } = useLocalSearchParams();
  return <BudgetDetails id={typeof id === 'string' ? id : ''} />;
}
