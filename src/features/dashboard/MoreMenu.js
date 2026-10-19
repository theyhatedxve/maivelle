import { router } from 'expo-router';
import { ChevronRight, Search, Settings } from 'lucide-react-native';
import { useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import AppHeader from '../../components/layout/AppHeader';
import ScreenContainer from '../../components/layout/ScreenContainer';
import AppCard from '../../components/ui/AppCard';
import AppText from '../../components/ui/AppText';
import EmptyState from '../../components/ui/EmptyState';
import IconBadge from '../../components/ui/IconBadge';
import { colors, radii, spacing, typography } from '../../theme';
import { dashboardData } from './dashboardData';
import { moduleIcons } from './moduleIcons';

const menuItems = [
  ...dashboardData.modules.map(({ id, title, href }) => ({ id, title, href, icon: moduleIcons[id] })),
  { id: 'settings', title: 'Settings', href: '/settings', icon: Settings },
];

export default function MoreMenu() {
  const [query, setQuery] = useState('');
  const items = menuItems.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <ScreenContainer tabScreen>
      <AppHeader title="More" subtitle="All your spaces, within reach" />
      <View style={styles.search}>
        <Search size={20} color={colors.muted} accessible={false} />
        <TextInput accessibilityLabel="Find a screen" placeholder="Find a screen" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="done" style={styles.input} />
      </View>
      <View style={styles.list}>
        {items.map((item) => (
          <AppCard key={item.id} style={styles.row} accessibilityLabel={`Open ${item.title}`} onPress={() => {
            Keyboard.dismiss();
            router.push(item.href);
          }}>
            <IconBadge icon={item.icon} />
            <AppText variant="label" style={styles.label}>{item.title}</AppText>
            <ChevronRight size={20} color={colors.muted} accessible={false} />
          </AppCard>
        ))}
        {!items.length ? <EmptyState icon={Search} title="No screens found" description="Try another screen name, or clear your search to see every space." /> : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 48, paddingVertical: spacing.md, color: colors.text, ...typography.body },
  list: { gap: spacing.md, marginTop: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1 },
});
