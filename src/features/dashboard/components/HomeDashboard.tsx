import { View } from 'react-native';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import { useLocalAccount } from '../../account/providers/LocalAccountProvider.tsx';
import { useDashboardClock, useDashboardExtras } from '../hooks/useDashboardExtras.ts';
import DashboardBrandHeader from './DashboardBrandHeader.tsx';
import DashboardPetals from './DashboardPetals.tsx';
import PrivacyBanner from './PrivacyBanner.tsx';
import DashboardSummaries from './DashboardSummaries.tsx';
import DashboardSectionHeading from './DashboardSectionHeading.tsx';
import QuickActions from './QuickActions.tsx';
import TodayFocus from './TodayFocus.tsx';
import RecentNotes from './RecentNotes.tsx';
import { useDashboardStyles } from './dashboardStyles.ts';

export default function HomeDashboard() {
  const styles = useDashboardStyles();
  const { state: account } = useLocalAccount();
  const now = useDashboardClock();
  const extras = useDashboardExtras();
  return (
    <ScreenContainer tabScreen>
      <View style={styles.page}>
        <DashboardPetals />
        <DashboardBrandHeader now={now} nickname={account.profile?.nickname} />
        <PrivacyBanner />
        <DashboardSummaries vaultCount={extras.vaultCount} vaultError={extras.vaultError} />
        <View style={styles.section}>
          <DashboardSectionHeading title="Quick Actions" href="/more" action="See all" />
          <QuickActions />
        </View>
        <View style={styles.section}>
          <DashboardSectionHeading title="Today’s Focus" href="/calendar" />
          <TodayFocus />
        </View>
        <View style={styles.section}>
          <DashboardSectionHeading title="Recent Notes" href="/notes" />
          <RecentNotes
            notes={extras.notes}
            loading={extras.loadingNotes}
            error={extras.notesError}
          />
        </View>
        <AppText variant="caption" tone="muted" style={styles.footnote}>
          Income is PHP only. Other modules are in More. Development storage encryption approval is
          pending; use fictional sensitive records.
        </AppText>
      </View>
    </ScreenContainer>
  );
}
