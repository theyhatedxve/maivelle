import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import AppCard from '../../components/ui/AppCard';
import AppText from '../../components/ui/AppText';
import IconBadge from '../../components/ui/IconBadge';
import { colors, spacing } from '../../theme';
import { dashboardData } from './dashboardData';
import { moduleIcons } from './moduleIcons';

export default function UpcomingItems() {
  return (
    <View style={styles.list}>
      {dashboardData.upcomingItems.filter((item) => !['tasks','calendar'].includes(item.module)).map((item) => (
        <AppCard key={item.id} style={styles.row} onPress={() => router.push(item.href)} accessibilityLabel={`Open ${item.title}, ${item.time}, sample item`}>
          <IconBadge icon={moduleIcons[item.module]} />
          <View style={styles.text}>
            <AppText variant="label">{item.title}</AppText>
            <AppText variant="caption" tone="muted">{item.time}</AppText>
          </View>
          <ChevronRight size={18} color={colors.muted} accessible={false} />
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: spacing.xs },
});
