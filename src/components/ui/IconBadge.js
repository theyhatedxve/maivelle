import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../../theme';

/** @param {{icon: import('lucide-react-native').LucideIcon}} props */
export default function IconBadge({ icon: Icon }) {
  return <View style={styles.badge}><Icon size={22} color={colors.primary} accessible={false} /></View>;
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', padding: spacing.md, borderRadius: radii.sm, backgroundColor: colors.lavenderSoft },
});
