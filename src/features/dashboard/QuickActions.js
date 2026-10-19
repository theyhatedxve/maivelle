import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import AppButton from '../../components/ui/AppButton';
import { spacing } from '../../theme';
import { dashboardData } from './dashboardData';
import { moduleIcons } from './moduleIcons';

export default function QuickActions() {
  return (
    <View style={styles.grid}>
      {dashboardData.quickActions.map((action) => (
        <View key={action.id} style={styles.action}>
          <AppButton label={action.label} icon={moduleIcons[action.id]} variant="secondary" onPress={() => router.push(action.href)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  action: { flexGrow: 1, flexBasis: '43%', minWidth: 120 },
});
