import { ActivityIndicator, View } from 'react-native';
import AppText from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { useUpcomingEvents } from '../hooks/useCalendar';
import CalendarEntryCard from './CalendarEntryCard';
import { CalendarError } from './CalendarControls';
import { calendarStyles as styles } from './calendarStyles';
export default function UpcomingCalendarEvents() {
  const query = useUpcomingEvents();
  return <View style={styles.section}>{query.error ? <CalendarError message={query.error} onRetry={query.refresh} /> : query.loading ? <ActivityIndicator color={colors.primary} /> : !query.events.length ? <AppText tone="muted">No upcoming events in the next 30 days.</AppText> : query.events.slice(0,3).map((entry) => <CalendarEntryCard key={entry.instanceId} entry={entry} categories={query.categories} />)}</View>;
}
