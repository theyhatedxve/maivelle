import { useTheme, useThemedStyles } from '../../theme/ThemeProvider.tsx';
import { Pressable, StyleSheet } from 'react-native';
import AppText from './AppText.tsx';
import { radii, spacing } from '../../theme/index.ts';

export type AppButtonProps = {
  label: string;
  onPress: () => void;
  icon?: import('lucide-react-native').LucideIcon;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  accessibilityLabel?: string;
};

export default function AppButton({
  label,
  onPress,
  icon: Icon,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
}: AppButtonProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      {Icon ? (
        <Icon size={18} color={primary ? colors.onPrimary : colors.primary} accessible={false} />
      ) : null}
      <AppText variant="label" tone={primary ? 'onPrimary' : 'primary'} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const makeStyles = (colors: typeof import('../../theme/colors').colors) =>
  StyleSheet.create({
    button: {
      minHeight: 48,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.lavender },
    label: { flexShrink: 1, textAlign: 'center' },
  });
