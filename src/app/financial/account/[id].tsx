import { useLocalSearchParams } from 'expo-router';
import AccountEditor from '../../../features/finance/components/AccountEditor.tsx';
export default function EditAccount() {
  const { id } = useLocalSearchParams();
  return <AccountEditor key={String(id)} id={typeof id === 'string' ? id : ''} />;
}
