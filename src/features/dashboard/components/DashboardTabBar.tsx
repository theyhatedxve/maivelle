import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays, FileText, House, LockKeyhole, Menu } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme, useThemedStyles } from '../../../theme/ThemeProvider.tsx';

const destinations = [
  { label: 'Home', route: 'index', href: '/', icon: House },
  { label: 'Plan', route: 'calendar', href: '/calendar', icon: CalendarDays },
  { label: 'Notes', route: 'notes', href: '/notes', icon: FileText },
  { label: 'Vault', route: 'vault', href: '/vault', icon: LockKeyhole },
  { label: 'More', route: 'more', href: '/more', icon: Menu },
];

/** Root Notes/Vault links preserve their existing editor stacks and Vault security gate. */
export default function DashboardTabBar({
  activeRoute,
  bottomInset,
}: {
  activeRoute: string;
  bottomInset: number;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setTyping(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setTyping(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  if (typing) return null;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {destinations.map(({ label, route, href, icon: Icon }) => {
        const selected = activeRoute === route;
        const color = selected ? colors.primary : colors.muted;
        return (
          <Pressable
            key={route}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            onPress={() => router.navigate(href)}
            style={styles.tab}
          >
            <Icon size={24} color={color} strokeWidth={selected ? 2.5 : 1.8} accessible={false} />
            <AppText variant="caption" style={{ color }}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
const makeStyles = (colors: typeof import('../../../theme/colors.ts').colors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      paddingTop: 10,
      paddingHorizontal: 8,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  });
