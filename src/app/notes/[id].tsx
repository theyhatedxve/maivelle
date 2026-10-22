import { useLocalSearchParams } from 'expo-router';
import NoteEditor from '../../features/notes/components/NoteEditor.tsx';
export default function EditNoteScreen() {
  const { id } = useLocalSearchParams();
  return <NoteEditor key={String(id)} id={typeof id === 'string' ? id : ''} />;
}
