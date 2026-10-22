import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { ActivityIndicator, View } from 'react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { useUpcomingEvents } from '../hooks/useCalendar.ts';
import CalendarEntryCard from './CalendarEntryCard.tsx';
import { CalendarError } from './CalendarControls.tsx';
import { useCalendarStyles } from './calendarStyles.ts';
export default function UpcomingCalendarEvents() {
  const styles = useCalendarStyles();
  const { colors } = useTheme();
  const query = useUpcomingEvents();
  return (
    <View style={styles.section}>
      {query.error ? (
        <CalendarError message={query.error} onRetry={query.refresh} />
      ) : query.loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : !query.events.length ? (
        <AppText tone="muted">No upcoming events in the next 30 days.</AppText>
      ) : (
        query.events
          .slice(0, 3)
          .map((entry) => (
            <CalendarEntryCard key={entry.instanceId} entry={entry} categories={query.categories} />
          ))
      )}
    </View>
  );
}
