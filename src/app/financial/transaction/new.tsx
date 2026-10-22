import { useLocalSearchParams } from 'expo-router';
import TransactionEditor from '../../../features/finance/components/TransactionEditor.tsx';
export default function NewTransaction() {
  const { type } = useLocalSearchParams();
  return (
    <TransactionEditor
      key={String(type)}
      id={null}
      initialType={typeof type === 'string' ? type : 'expense'}
    />
  );
}
