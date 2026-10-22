import { useState } from 'react';
import { KeyRound } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import BrandButton from '../../../components/branding/BrandButton.tsx';
import { useLocalAccount } from '../providers/LocalAccountProvider.tsx';
import { useAccountForm } from '../hooks/useAccountForm.ts';
import AccountFrame from './AccountFrame.tsx';
import AccountField from './AccountField.tsx';
import { accountStyles as styles } from './accountStyles.ts';
import { AccountHint } from './AccountLayout.tsx';

export default function PinUnlockScreen() {
  const { service, state } = useLocalAccount();
  const [changing, setChanging] = useState(false);
  const form = useAccountForm();
  return (
    <AccountFrame
      title={changing ? 'Choose a new PIN' : `Hello, ${state.profile?.nickname ?? 'you'}`}
      subtitle={
        changing
          ? 'Your password was verified for this change.'
          : 'Enter your PIN to open your space.'
      }
    >
      <AccountField
        label={changing ? 'New PIN' : 'PIN'}
        icon={KeyRound}
        placeholder="6–12 digits"
        value={form.pin}
        onChangeText={form.setPin}
        maxLength={12}
        keyboardType="number-pad"
        autoComplete="off"
        secret
        editable={!state.busy}
      />
      {form.error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {form.error}
        </Text>
      ) : null}
      <BrandButton
        label={state.busy ? 'Checking securely…' : changing ? 'Save new PIN' : 'Unlock Maivelle'}
        busy={state.busy}
        onPress={() => {
          void form.run(() => (changing ? service.changePin(form.pin) : service.unlock(form.pin)));
        }}
      />
      {state.canChangePin && !changing ? (
        <Pressable
          accessibilityRole="button"
          disabled={state.busy}
          onPress={() => setChanging(true)}
          style={styles.link}
        >
          <Text style={styles.linkText}>Forgot your PIN? Set a new one</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={state.busy}
        onPress={() => {
          void form.run(() => service.signOut());
        }}
        style={styles.link}
      >
        <Text style={styles.linkText}>Use username and password instead</Text>
      </Pressable>
      <AccountHint>
        This unlocks Maivelle only. Your Vault keeps its separate master password and key
        authorization.
      </AccountHint>
    </AccountFrame>
  );
}
