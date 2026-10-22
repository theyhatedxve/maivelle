import { router } from 'expo-router';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { FilePlus2, LockKeyhole, Plus, Upload } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useDashboardStyles } from './dashboardStyles.ts';

const actions = [
  { label: 'Add Note', icon: FilePlus2, href: '/notes/new' },
  { label: 'New Task', icon: Plus, href: '/task/new' },
  { label: 'Add Credential', icon: LockKeyhole, href: '/vault/new' },
  { label: 'Backup Now', icon: Upload, href: '/settings/backup' },
];
export default function QuickActions() {
  const styles = useDashboardStyles();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  return (
    <View style={styles.actionGrid}>
      {actions.map(({ label, icon: Icon, href }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => router.push(href)}
          style={({ pressed }) => [
            styles.action,
            (width < 350 || fontScale > 1.2) && styles.actionWide,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={styles.actionIcon}>
            <Icon size={25} color={colors.primary} accessible={false} />
          </View>
          <AppText style={styles.actionLabel} tone="muted">
            {label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
