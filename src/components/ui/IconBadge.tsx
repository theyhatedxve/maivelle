import { useTheme, useThemedStyles } from '../../theme/ThemeProvider.tsx';
import { StyleSheet, View } from 'react-native';
import { radii, spacing } from '../../theme/index.ts';

export type IconBadgeProps = {
  icon: import('lucide-react-native').LucideIcon;
};

export default function IconBadge({ icon: Icon }: IconBadgeProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.badge}>
      <Icon size={22} color={colors.primary} accessible={false} />
    </View>
  );
}

const makeStyles = (colors: typeof import('../../theme/colors').colors) =>
  StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      padding: spacing.md,
      borderRadius: radii.sm,
      backgroundColor: colors.lavenderSoft,
    },
  });
