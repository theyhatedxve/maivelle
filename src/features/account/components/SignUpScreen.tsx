import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { AtSign, KeyRound, LockKeyhole, UserRound } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import BrandButton from '../../../components/branding/BrandButton.tsx';
import { useLocalAccount } from '../providers/LocalAccountProvider.tsx';
import { useAccountForm } from '../hooks/useAccountForm.ts';
import AccountFrame from './AccountFrame.tsx';
import AccountField from './AccountField.tsx';
import { accountStyles as styles } from './accountStyles.ts';
import { AccountHint } from './AccountLayout.tsx';

export default function SignUpScreen() {
  const { service, state } = useLocalAccount();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const form = useAccountForm();
  if (state.profile) return <Redirect href="/" />;
  return (
    <AccountFrame
      title="Create your space"
      subtitle="Start organizing everything you value."
      onBack={() => router.replace('/welcome')}
    >
      <AccountField
        label="Full name"
        icon={UserRound}
        placeholder="e.g. Jane Doe"
        value={name}
        onChangeText={setName}
        maxLength={80}
        autoCapitalize="words"
        autoComplete="name"
        editable={!state.busy}
      />
      <AccountField
        label="Nickname / username"
        icon={AtSign}
        placeholder="What should we call you?"
        value={nickname}
        onChangeText={setNickname}
        maxLength={32}
        autoCapitalize="none"
        autoComplete="username-new"
        editable={!state.busy}
      />
      <AccountField
        label="PIN"
        icon={KeyRound}
        placeholder="6–12 digits for quick unlock"
        value={form.pin}
        onChangeText={form.setPin}
        maxLength={12}
        keyboardType="number-pad"
        autoComplete="off"
        secret
        editable={!state.busy}
      />
      <AccountField
        label="Password"
        icon={LockKeyhole}
        placeholder="At least 12 characters"
        value={form.password}
        onChangeText={form.setPassword}
        maxLength={900}
        autoCapitalize="none"
        autoComplete="new-password"
        secret
        editable={!state.busy}
      />
      <AccountHint>
        Your nickname is your login username. This profile stays on this device—no email or online
        account needed.
      </AccountHint>
      {form.error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {form.error}
        </Text>
      ) : null}
      <BrandButton
        label={state.busy ? 'Securing your local profile…' : 'Create my space'}
        busy={state.busy}
        onPress={() => {
          void form.run(async () => {
            await service.setup({ name, nickname, password: form.password, pin: form.pin });
            router.replace('/');
          });
        }}
      />
      <Pressable
        disabled={state.busy}
        accessibilityRole="button"
        onPress={() => router.replace('/sign-in')}
        style={styles.link}
      >
        <Text style={styles.linkText}>Already set up on this device? Sign in</Text>
      </Pressable>
    </AccountFrame>
  );
}
