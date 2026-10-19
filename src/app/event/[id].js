import { useLocalSearchParams } from 'expo-router';
import EventEditor from '../../features/calendar/components/EventEditor';
import { localToday } from '../../features/calendar/services/calendarDates';
export default function EditEventScreen() { const { id, occurrence } = useLocalSearchParams(); return <EventEditor key={`${id}:${occurrence ?? 'series'}`} id={typeof id === 'string' ? id : ''} occurrence={typeof occurrence === 'string' ? occurrence : null} date={localToday()} />; }
