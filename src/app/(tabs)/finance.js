import { router } from 'expo-router';
import { PiggyBank, Wallet } from 'lucide-react-native';
import ModulePlaceholder from '../../components/layout/ModulePlaceholder';
import AppButton from '../../components/ui/AppButton';

export default function FinanceScreen() {
  return <ModulePlaceholder title="Finance" icon={Wallet} tabScreen description="An overview of your everyday money. Transactions and calculations are not available yet." action={<AppButton label="Explore Budget" icon={PiggyBank} onPress={() => router.push('/budget')} />} />;
}
