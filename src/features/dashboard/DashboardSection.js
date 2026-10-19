import { StyleSheet, View } from 'react-native';
import AppText from '../../components/ui/AppText';
import { spacing } from '../../theme';

/** @param {{title: string, subtitle?: string, children: import('react').ReactNode}} props */
export default function DashboardSection({ title, subtitle, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <AppText variant="heading" accessibilityRole="header">{title}</AppText>
        {subtitle ? <AppText variant="caption" tone="muted">{subtitle}</AppText> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl, gap: spacing.md },
  heading: { gap: spacing.xs },
});
