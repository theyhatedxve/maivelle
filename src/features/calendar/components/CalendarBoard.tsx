import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { Pressable, View } from 'react-native';
import { CheckSquare } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { addDays, civilDate, localToday } from '../services/calendarDates.ts';
import { usePlanStyles } from './planStyles.ts';
import PlanGradient from './PlanGradient.tsx';

export type CalendarBoardProps = {
  days: string[];
  selected: string;
  displayMonth?: string;
  entries: import('../services/calendarService.ts').CalendarEntry[];
  categories: import('../../../database/repositories/calendarRepository.ts').CalendarCategory[];
  onSelect: (day: string) => void;
};

export default function CalendarBoard({
  days,
  selected,
  displayMonth = selected.slice(0, 7),
  entries,
  categories,
  onSelect,
}: CalendarBoardProps) {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  // Keep complete weeks, but omit trailing weeks that contain no displayed-month dates.
  // The existing 42-day query remains unchanged; weeks needing six rows still get six.
  let end = days.length;
  while (end > 7 && days.slice(end - 7, end).every((day) => day.slice(0, 7) !== displayMonth))
    end -= 7;
  const visibleDays = days.slice(0, end);
  return (
    <View style={styles.board}>
      <View style={styles.boardGrid}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <AppText key={index} variant="caption" tone="muted" style={styles.weekday}>
            {day}
          </AppText>
        ))}
        {visibleDays.map((day) => {
          const end = `${addDays(day, 1)}T00:00`;
          const start = `${day}T00:00`;
          const items = entries.filter((entry) => entry.startLocal < end && entry.endLocal > start);
          const events = items.filter((entry) => entry.type === 'event');
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`Select ${day}, ${items.length} items`}
              accessibilityState={{ selected: day === selected }}
              onPress={() => onSelect(day)}
              style={[
                styles.day,
                day === localToday() && styles.todayDay,
                selected === day && styles.selectedDay,
              ]}
            >
              {selected === day ? <PlanGradient /> : null}
              <AppText
                variant="label"
                tone={
                  day === selected
                    ? 'onPrimary'
                    : day.slice(0, 7) === displayMonth
                      ? 'text'
                      : 'muted'
                }
              >
                {civilDate(day).getUTCDate()}
              </AppText>
              <View style={styles.dots}>
                {events.slice(0, 2).map((entry) => (
                  <View
                    key={entry.instanceId}
                    style={[
                      styles.calendarDot,
                      {
                        backgroundColor:
                          categories.find((category) => category.id === entry.categoryId)?.color ??
                          colors.primary,
                      },
                    ]}
                  />
                ))}
                {items.some((entry) => entry.type === 'task') && (
                  <CheckSquare
                    size={10}
                    color={day === selected ? colors.onPrimary : colors.primary}
                    accessible={false}
                  />
                )}
                {items.length > 2 && (
                  <AppText variant="caption" tone={day === selected ? 'onPrimary' : 'muted'}>
                    +
                  </AppText>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
