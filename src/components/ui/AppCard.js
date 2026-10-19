import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../../theme';

/** @param {{children: import('react').ReactNode, style?: import('react-native').StyleProp<import('react-native').ViewStyle>, onPress?: () => void, accessibilityLabel?: string}} props */
export default function AppCard({ children, style, onPress, accessibilityLabel }) {
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  pressed: { backgroundColor: colors.lavenderSoft, opacity: 0.85 },
});
