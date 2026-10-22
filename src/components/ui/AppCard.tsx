import { useThemedStyles } from '../../theme/ThemeProvider.tsx';
import { Pressable, StyleSheet, View } from 'react-native';
import { radii, spacing } from '../../theme/index.ts';

export type AppCardProps = {
  children: import('react').ReactNode;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export default function AppCard({ children, style, onPress, accessibilityLabel }: AppCardProps) {
  const styles = useThemedStyles(makeStyles);
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const makeStyles = (colors: typeof import('../../theme/colors').colors) =>
  StyleSheet.create({
    card: {
      padding: spacing.lg,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    pressed: { backgroundColor: colors.lavenderSoft, opacity: 0.85 },
  });
