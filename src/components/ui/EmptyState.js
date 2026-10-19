import { StyleSheet, View } from 'react-native';
import AppText from './AppText';
import IconBadge from './IconBadge';
import { spacing } from '../../theme';

/** @param {{icon: import('lucide-react-native').LucideIcon, title: string, description: string, action?: import('react').ReactNode}} props */
export default function EmptyState({ icon, title, description, action }) {
  return (
    <View style={styles.container}>
      <IconBadge icon={icon} />
      <AppText variant="heading">{title}</AppText>
      <AppText tone="muted" style={styles.description}>{description}</AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start', gap: spacing.lg, paddingVertical: spacing.xl },
  description: { maxWidth: 480 },
});
