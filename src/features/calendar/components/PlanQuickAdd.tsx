import { Pressable, View } from 'react-native';
import { CalendarDays, CheckSquare, MapPin, Star } from 'lucide-react-native';
import { router } from 'expo-router';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { usePlanStyles } from './planStyles.ts';

export default function PlanQuickAdd({ date }: { date: string }) {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  const items = [
    {
      label: 'Event',
      icon: CalendarDays,
      onPress: () => router.push({ pathname: '/event/new', params: { date } }),
    },
    { label: 'Task', icon: CheckSquare, onPress: () => router.push('/task/new') },
    {
      label: 'Location',
      icon: MapPin,
      onPress: () => router.push({ pathname: '/event/new', params: { date, focus: 'location' } }),
    },
    { label: 'Note', icon: Star, onPress: () => router.push('/notes/new') },
  ];
  return (
    <View style={styles.quickAdd}>
      <AppText variant="heading">Quick Add</AppText>
      <View style={styles.quickGrid}>
        {items.map(({ label, icon: Icon, onPress }) => (
          <Pressable
            key={label}
            style={styles.quick}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={
              label === 'Location' ? 'Create event with location' : `Add ${label.toLowerCase()}`
            }
          >
            <Icon color={colors.primary} size={23} accessible={false} />
            <AppText variant="caption" tone="muted">
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
