import { useTheme } from '../../theme/ThemeProvider.tsx';
import { Stack } from 'expo-router';
export const unstable_settings = { anchor: 'index' };
export default function NotesLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
