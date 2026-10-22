import { useLocalSearchParams } from 'expo-router';
import TransactionHistory from '../../features/finance/components/TransactionHistory.tsx';
export default function FinancialHistory() {
  const { accountId } = useLocalSearchParams();
  return (
    <TransactionHistory
      key={String(accountId)}
      initialAccountId={typeof accountId === 'string' ? accountId : ''}
    />
  );
}
