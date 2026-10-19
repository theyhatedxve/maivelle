import { useLocalSearchParams } from 'expo-router';
import EventEditor from '../../features/calendar/components/EventEditor';
import { localToday, validateDate } from '../../features/calendar/services/calendarDates';
export default function NewEventScreen() { const { date } = useLocalSearchParams(); let day = localToday(); try { if (typeof date === 'string') day = validateDate(date); } catch { /* Invalid optional dates fall back to today. */ } return <EventEditor id={null} occurrence={null} date={day} />; }
