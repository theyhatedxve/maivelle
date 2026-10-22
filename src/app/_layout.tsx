import { Stack } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider.tsx';
import AppProviders from '../providers/AppProviders.tsx';
import LocalAccountProvider from '../features/account/providers/LocalAccountProvider.tsx';
import LocalAccountGate from '../features/account/providers/LocalAccountGate.tsx';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  return (
    <AppProviders>
      <LocalAccountProvider>
        <LocalAccountGate>
          <ThemedNavigator />
        </LocalAccountGate>
      </LocalAccountProvider>
    </AppProviders>
  );
}

function ThemedNavigator() {
  const { colors } = useTheme();
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="sign-up" options={{ gestureEnabled: false }} />
        <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
        <Stack.Screen name="notes" />
        <Stack.Screen name="task" />
        <Stack.Screen name="event" />
        <Stack.Screen name="medicine" />
        <Stack.Screen name="timer" />
        <Stack.Screen name="financial" />
        <Stack.Screen name="vault" options={{ animation: 'none' }} />
        <Stack.Screen name="budget" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
