import { useLocalSearchParams } from 'expo-router';
import MedicineDetails from '../../features/medicine/components/MedicineDetails.tsx';
export default function MedicineRoute() {
  const { id } = useLocalSearchParams();
  return <MedicineDetails id={typeof id === 'string' ? id : ''} />;
}
