import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import { useDatabase } from '../../../database/DatabaseProvider.tsx';
import { spacing } from '../../../theme/index.ts';
import { calendarError } from '../hooks/useCalendar.ts';
import { CalendarError } from './CalendarControls.tsx';
import { useCalendarStyles } from './calendarStyles.ts';
export default function EventSeriesList() {
  const styles = useCalendarStyles();
  const { colors } = useTheme();
  const { calendarService } = useDatabase();
  const [events, setEvents] = useState(
    [] as import('../../../database/repositories/calendarRepository.ts').CalendarEvent[],
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const request = useRef(0);
  const busy = useRef(false);
  const load = useCallback(
    async (offset = 0) => {
      if (offset && busy.current) return;
      const current = offset ? request.current : ++request.current;
      busy.current = true;
      try {
        const rows = await calendarService.listSeries(50, offset);
        if (current === request.current) {
          setEvents((old) =>
            offset
              ? [...old, ...rows.filter((row) => !old.some((item) => item.id === row.id))]
              : rows,
          );
          setHasMore(rows.length === 50);
          setError('');
        }
      } catch (failure) {
        if (current === request.current) setError(calendarError(failure));
      } finally {
        if (current === request.current) {
          setLoading(false);
          busy.current = false;
        }
      }
    },
    [calendarService],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
      const unsubscribe = calendarService.subscribe(() => {
        void load();
      });
      return () => {
        request.current++;
        busy.current = false;
        unsubscribe();
      };
    }, [load, calendarService]),
  );
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={events}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        onEndReached={() => {
          if (hasMore && !error) void load(events.length);
        }}
        ListHeaderComponent={
          <View style={styles.section}>
            <AppHeader
              title="Event series"
              subtitle="Includes series with cancelled or moved occurrences"
              back
            />
            {error && (
              <CalendarError
                message={error}
                onRetry={() => {
                  void load();
                }}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : error ? undefined : (
            <AppText>No event series yet.</AppText>
          )
        }
        renderItem={({ item }) => (
          <AppCard
            onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id } })}
            accessibilityLabel={`Edit series ${item.title}`}
          >
            <AppText variant="heading">{item.title}</AppText>
            <AppText tone="muted">
              {item.startLocal.replace('T', ' ')} · {item.recurrence?.frequency ?? 'Once'}
            </AppText>
          </AppCard>
        )}
      />
    </SafeAreaView>
  );
}
