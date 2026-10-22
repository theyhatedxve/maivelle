import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useDashboardStyles } from './dashboardStyles.ts';

export default function DashboardSectionHeading({
  title,
  href,
  action = 'View all',
}: {
  title: string;
  href: string;
  action?: string;
}) {
  const styles = useDashboardStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading" style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </AppText>
      <Pressable
        style={styles.seeAll}
        accessibilityRole="button"
        accessibilityLabel={`${action}: ${title}`}
        onPress={() => router.push(href)}
      >
        <AppText variant="caption" tone="primary">
          {action}
        </AppText>
        <ChevronRight color={colors.primary} size={16} accessible={false} />
      </Pressable>
    </View>
  );
}
