import { useLocalSearchParams } from 'expo-router';
import TransactionEditor from '../../../features/finance/components/TransactionEditor.tsx';
export default function EditTransaction() {
  const { id } = useLocalSearchParams();
  return <TransactionEditor key={String(id)} id={typeof id === 'string' ? id : ''} />;
}
