import { useEffect, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { router, useSegments } from 'expo-router';
import { Modal, View, Text } from 'react-native';
import { useSettings } from '../../settings/providers/SettingsProvider.tsx';
import BrandButton from '../../../components/branding/BrandButton.tsx';
import AccountFrame from '../components/AccountFrame.tsx';
import PinUnlockScreen from '../components/PinUnlockScreen.tsx';
import SignInScreen from '../components/SignInScreen.tsx';
import { useLocalAccount } from './LocalAccountProvider.tsx';
import { accountStyles } from '../components/accountStyles.ts';

/** Keep Router mounted and cover it with a native modal when access is locked. */
export default function LocalAccountGate({ children }: PropsWithChildren) {
  const { service, state } = useLocalAccount();
  const { preferences } = useSettings();
  const segments = useSegments();
  const route = segments[0] as string | undefined;
  const lastTouch = useRef(0);
  useEffect(() => {
    lastTouch.current = performance.now();
    if (!state.unlocked || !preferences.localPinIdleLock) return;
    const timer = setInterval(() => {
      if (performance.now() - lastTouch.current >= preferences.inactivitySeconds * 1000)
        service.lock();
    }, 1000);
    return () => clearInterval(timer);
  }, [state.unlocked, service, preferences.inactivitySeconds, preferences.localPinIdleLock]);

  const publicRoute = ['welcome', 'sign-up', 'sign-in'].includes(route ?? '');
  const covered = !state.ready || (state.profile ? !state.unlocked : !publicRoute);
  return (
    <View
      style={accountStyles.fill}
      onTouchStart={() => {
        lastTouch.current = performance.now();
      }}
    >
      <View
        style={[accountStyles.fill, { opacity: covered ? 0 : 1 }]}
        pointerEvents={covered ? 'none' : 'auto'}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      <Modal
        visible={covered}
        animationType="none"
        onRequestClose={() => {}}
        statusBarTranslucent
        navigationBarTranslucent
      >
        {!state.ready ? (
          <AccountFrame
            title={state.error ? 'Profile unavailable' : 'Opening Maivelle'}
            subtitle="Your local records and Vault keys remain unchanged."
          >
            <Text style={state.error ? accountStyles.error : accountStyles.message}>
              {state.error || 'Loading protected local profile…'}
            </Text>
            {state.error ? (
              <BrandButton
                label="Retry protected profile"
                busy={state.busy}
                onPress={() => {
                  void service.refresh();
                }}
              />
            ) : null}
          </AccountFrame>
        ) : state.profile ? (
          state.signedIn ? (
            <PinUnlockScreen key={`pin-${state.epoch}`} />
          ) : (
            <SignInScreen key={`login-${state.epoch}`} />
          )
        ) : (
          <AccountFrame title="Welcome to Maivelle" subtitle="Create your local space to continue.">
            <BrandButton label="View welcome" onPress={() => router.replace('/welcome')} />
          </AccountFrame>
        )}
      </Modal>
    </View>
  );
}
