import { useLocalSearchParams } from 'expo-router';
import BudgetHistory from '../../../../features/budget/components/BudgetHistory.tsx';
export default function AllocationRoute() {
  const { id, allocationId } = useLocalSearchParams();
  return (
    <BudgetHistory
      id={typeof id === 'string' ? id : ''}
      allocationId={typeof allocationId === 'string' ? allocationId : ''}
    />
  );
}
