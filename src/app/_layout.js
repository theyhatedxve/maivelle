import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../theme';
import DatabaseProvider from '../database/DatabaseProvider';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <DatabaseProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="notes" />
          <Stack.Screen name="task" />
          <Stack.Screen name="event" />
          <Stack.Screen name="medicine" />
          <Stack.Screen name="timer" />
          <Stack.Screen name="vault" />
          <Stack.Screen name="budget" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="database-diagnostics" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
