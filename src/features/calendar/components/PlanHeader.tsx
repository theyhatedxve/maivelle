import { Pressable, View } from 'react-native';
import { ChevronLeft, UserRound } from 'lucide-react-native';
import { router } from 'expo-router';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { usePlanStyles } from './planStyles.ts';

export default function PlanHeader({
  title = 'Plan',
  subtitle = 'Your schedule and tasks in one place.',
  back = false,
  profile = true,
  onBack,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  profile?: boolean;
  onBack?: () => void;
}) {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Back to Plan"
          onPress={
            onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/calendar')))
          }
        >
          <ChevronLeft color={colors.text} size={25} accessible={false} />
        </Pressable>
      ) : null}
      <View style={styles.headerCopy}>
        <AppText style={styles.title} accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="caption" tone="muted">
          {subtitle}
        </AppText>
      </View>
      {profile ? (
        <Pressable
          style={styles.profile}
          accessibilityRole="button"
          accessibilityLabel="Open profile settings"
          onPress={() => router.push('/settings/security')}
        >
          <UserRound size={23} color={colors.primary} accessible={false} />
        </Pressable>
      ) : null}
    </View>
  );
}
