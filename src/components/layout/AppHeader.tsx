import { useTheme, useThemedStyles } from '../../theme/ThemeProvider.tsx';
import { router } from 'expo-router';
import { ArrowLeft, Settings } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '../ui/AppText.tsx';
import { radii, spacing } from '../../theme/index.ts';

export type AppHeaderProps = {
  title: string;
  subtitle?: string;
  back?: boolean;
  settings?: boolean;
};

export default function AppHeader({
  title,
  subtitle,
  back = false,
  settings = false,
}: AppHeaderProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <ArrowLeft color={colors.text} size={22} accessible={false} />
        </Pressable>
      ) : null}
      <View style={styles.title}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {settings ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Settings color={colors.primary} size={22} accessible={false} />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: typeof import('../../theme/colors').colors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    title: { flex: 1, gap: spacing.xs },
    action: {
      minWidth: 48,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.sm,
      backgroundColor: colors.lavender,
    },
    pressed: { opacity: 0.65 },
  });
