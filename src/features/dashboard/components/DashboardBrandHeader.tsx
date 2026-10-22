import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Sparkles, UserRound } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useDashboardStyles } from './dashboardStyles.ts';

export default function DashboardBrandHeader({ now, nickname }: { now: Date; nickname?: string }) {
  const styles = useDashboardStyles();
  const { colors } = useTheme();
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <>
      <View style={styles.brandRow}>
        <Image
          source={require('../../../../assets/branding/maivelle-app-icon.png')}
          style={styles.brandIcon}
          resizeMode="contain"
          accessible={false}
        />
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>Maivelle</Text>
          <Text style={styles.slogan}>Everything You Value, in One Place.</Text>
        </View>
        <Pressable
          style={styles.avatar}
          onPress={() => router.push('/settings/security')}
          accessibilityRole="button"
          accessibilityLabel="Open profile and security settings"
        >
          <UserRound size={24} color={colors.primary} accessible={false} />
        </Pressable>
      </View>
      <View style={styles.intro}>
        <AppText tone="muted">
          {now.toLocaleDateString('en-PH', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </AppText>
        <View style={styles.greetingRow}>
          <AppText style={styles.greeting} accessibilityRole="header">
            {greeting}
          </AppText>
          <Sparkles color={colors.primary} size={24} accessible={false} />
        </View>
        <AppText tone="muted">
          {nickname
            ? `${nickname}, everything important is in one place.`
            : 'Everything important, in one place.'}
        </AppText>
      </View>
    </>
  );
}
