import { useLocalSearchParams } from 'expo-router';
import SessionEditor from '../../features/timeTracker/components/SessionEditor';
export default function EditSession() {
  const { id } = useLocalSearchParams();
  return (
    <SessionEditor key={String(id)} id={typeof id === 'string' ? id : ''} />
  );
}
