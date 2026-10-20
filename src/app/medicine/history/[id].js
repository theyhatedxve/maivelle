import { useLocalSearchParams } from 'expo-router';
import MedicineToday from '../../../features/medicine/components/MedicineToday';
export default function MedicineHistoryRoute(){const {id}=useLocalSearchParams();return <MedicineToday medicineId={typeof id==='string'?id:''}/>;}
