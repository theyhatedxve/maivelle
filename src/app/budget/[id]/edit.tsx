import { useLocalSearchParams } from 'expo-router';
import BudgetEditor from '../../../features/budget/components/BudgetEditor.tsx';
export default function EditBudgetRoute() {
  const { id } = useLocalSearchParams();
  return <BudgetEditor id={typeof id === 'string' ? id : ''} />;
}
