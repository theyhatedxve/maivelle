import { useLocalSearchParams } from 'expo-router';
import BudgetEditor from '../../../features/budget/components/BudgetEditor.tsx';
export default function DivideBudgetRoute() {
  const { id, allocationId } = useLocalSearchParams();
  return (
    <BudgetEditor
      divide
      id={typeof id === 'string' ? id : ''}
      allocationId={typeof allocationId === 'string' ? allocationId : undefined}
    />
  );
}
