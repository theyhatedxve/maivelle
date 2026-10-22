import { useState } from 'react';
import { AtSign, LockKeyhole } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import BrandButton from '../../../components/branding/BrandButton.tsx';
import { useLocalAccount } from '../providers/LocalAccountProvider.tsx';
import { useAccountForm } from '../hooks/useAccountForm.ts';
import AccountFrame from './AccountFrame.tsx';
import AccountField from './AccountField.tsx';
import { accountStyles as styles } from './accountStyles.ts';
import { AccountHint } from './AccountLayout.tsx';

export default function SignInScreen() {
  const { service, state } = useLocalAccount();
  const [username, setUsername] = useState('');
  const form = useAccountForm();
  return (
    <AccountFrame
      title="Welcome back"
      subtitle="Sign in to your personal space."
      onBack={!state.profile ? () => router.replace('/welcome') : undefined}
    >
      <AccountField
        label="Username"
        icon={AtSign}
        placeholder="Your nickname"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
        maxLength={32}
        editable={!state.busy}
      />
      <AccountField
        label="Password"
        icon={LockKeyhole}
        placeholder="Your local profile password"
        value={form.password}
        onChangeText={form.setPassword}
        autoCapitalize="none"
        autoComplete="current-password"
        maxLength={900}
        secret
        editable={!state.busy}
      />
      {form.error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {form.error}
        </Text>
      ) : null}
      <BrandButton
        label={state.busy ? 'Signing in securely…' : 'Sign in'}
        busy={state.busy}
        onPress={() => {
          void form.run(async () => {
            await service.signIn(username, form.password);
            router.replace('/');
          });
        }}
      />
      <AccountHint>
        After signing in, enter your PIN to unlock. Next time, you only need your PIN unless you
        sign out.
      </AccountHint>
      {!state.profile ? (
        <>
          <AccountHint>
            There is no local profile on this device yet. A profile on another phone does not
            transfer through login.
          </AccountHint>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/sign-up')}
            style={styles.link}
          >
            <Text style={styles.linkText}>Create your local profile</Text>
          </Pressable>
        </>
      ) : null}
    </AccountFrame>
  );
}
