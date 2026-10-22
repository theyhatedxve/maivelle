import { useLocalSearchParams } from 'expo-router';
import MedicineEditor from '../../../features/medicine/components/MedicineEditor.tsx';
export default function EditMedicineRoute() {
  const { id } = useLocalSearchParams();
  return <MedicineEditor key={String(id)} id={typeof id === 'string' ? id : ''} />;
}
