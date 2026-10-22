import { useLocalSearchParams } from 'expo-router';
import TaskEditor from '../../features/tasks/components/TaskEditor.tsx';
export default function EditTaskScreen() {
  const { id } = useLocalSearchParams();
  return <TaskEditor key={String(id)} id={typeof id === 'string' ? id : ''} />;
}
