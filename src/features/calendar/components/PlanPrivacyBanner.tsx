import { Pressable, View } from 'react-native';
import { ChevronRight, LockKeyhole } from 'lucide-react-native';
import { router } from 'expo-router';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { usePlanStyles } from './planStyles.ts';

export default function PlanPrivacyBanner() {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      style={styles.privacy}
      onPress={() => router.push('/settings/security')}
      accessibilityRole="button"
      accessibilityLabel="Local calendar storage and privacy information"
    >
      <View style={styles.privacyBadge}>
        <LockKeyhole size={22} color={colors.primary} accessible={false} />
      </View>
      <View style={styles.flex}>
        <AppText variant="label">Stored only on this device</AppText>
        <AppText variant="caption" tone="muted">
          Your events and plans stay local, without cloud sync.
        </AppText>
      </View>
      <ChevronRight color={colors.primary} size={16} accessible={false} />
    </Pressable>
  );
}
