import { Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import ScreenContainer from '../../components/layout/ScreenContainer';
import AppHeader from '../../components/layout/AppHeader';
import AppText from '../../components/ui/AppText';
import { colors, radii, spacing } from '../../theme';
import { dashboardData } from './dashboardData';
import DashboardSection from './DashboardSection';
import ModuleGrid from './ModuleGrid';
import QuickActions from './QuickActions';
import UpcomingItems from './UpcomingItems';
import TodayTasks from '../tasks/components/TodayTasks';
import UpcomingCalendarEvents from '../calendar/components/UpcomingCalendarEvents';

export default function HomeDashboard() {
  return (
    <ScreenContainer tabScreen>
      <AppHeader title="Maivelle" subtitle="Make room for what matters" settings />
      <View style={styles.hero}>
        <View style={styles.eyebrow}>
          <Sparkles size={18} color={colors.onPrimaryMuted} accessible={false} />
          <AppText variant="caption" tone="onPrimaryMuted" style={styles.flex}>{dashboardData.greeting}</AppText>
        </View>
        <AppText variant="display" tone="onPrimary">{dashboardData.headline}</AppText>
        <AppText tone="onPrimaryMuted">{dashboardData.description}</AppText>
        <AppText variant="caption" tone="onPrimaryMuted">{dashboardData.dateLabel}</AppText>
      </View>
      <DashboardSection title="Your everyday, at a glance" subtitle="Live Calendar, Tasks and Notes · Other spaces show samples">
        <ModuleGrid />
      </DashboardSection>
      <DashboardSection title="A small step forward" subtitle="Quick actions open their module previews">
        <QuickActions />
      </DashboardSection>
      <DashboardSection title="Today's tasks" subtitle="Incomplete tasks due today on this device">
        <TodayTasks />
      </DashboardSection>
      <DashboardSection title="Upcoming events" subtitle="Local Calendar · Next 30 days"><UpcomingCalendarEvents /></DashboardSection>
      <DashboardSection title="On the horizon" subtitle="Upcoming sample items">
        <UpcomingItems />
      </DashboardSection>
      <AppText variant="caption" tone="muted" style={styles.footer}>Calendar, Tasks and Notes show local records. Other dashboard values are examples.</AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.lg, borderTopWidth: spacing.xs, borderTopColor: colors.accent },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  footer: { marginTop: spacing.xl, textAlign: 'center' },
});
