import { useTheme } from '../../theme/ThemeProvider.tsx';
import { Stack } from 'expo-router';
export default function EventLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
