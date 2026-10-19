import { Pressable, View } from 'react-native';
import { CheckSquare } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText';
import { colors } from '../../../theme';
import { addDays, civilDate } from '../services/calendarDates';
import { calendarStyles as styles } from './calendarStyles';

/** @param {{days: string[], selected: string, entries: import('../services/calendarService.js').CalendarEntry[], categories: import('../../../database/repositories/calendarRepository.js').CalendarCategory[], onSelect: (day: string) => void}} props */
export default function CalendarBoard({ days, selected, entries, categories, onSelect }) {
  return <View style={styles.grid}>{['S','M','T','W','T','F','S'].map((day,index) => <AppText key={index} variant="caption" tone="muted" style={styles.weekday}>{day}</AppText>)}
    {days.map((day) => {
      const end = `${addDays(day,1)}T00:00`; const start = `${day}T00:00`;
      const items = entries.filter((entry) => entry.startLocal < end && entry.endLocal > start);
      const events = items.filter((entry) => entry.type === 'event');
      return <Pressable key={day} accessibilityRole="button" accessibilityLabel={`Select ${day}, ${items.length} items`} accessibilityState={{ selected: day === selected }} onPress={() => onSelect(day)} style={[styles.day, selected === day && styles.selected]}>
        <AppText variant="label" tone={day.slice(0,7) === selected.slice(0,7) ? 'text' : 'muted'}>{civilDate(day).getUTCDate()}</AppText>
        <View style={styles.dots}>{events.slice(0,2).map((entry) => <View key={entry.instanceId} style={[styles.dot, { backgroundColor: categories.find((category) => category.id === entry.categoryId)?.color ?? colors.primary }]} />)}{items.some((entry) => entry.type === 'task') && <CheckSquare size={10} color={colors.primary} />}{items.length > 2 && <AppText variant="caption">+</AppText>}</View>
      </Pressable>;
    })}
  </View>;
}
