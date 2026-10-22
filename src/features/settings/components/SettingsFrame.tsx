import { useState } from 'react';
import { View } from 'react-native';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { spacing } from '../../../theme/index.ts';

export type SettingsFrameProps = {
  title: string;
  children: import('react').ReactNode;
};

export type PreferenceToggleProps = {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
};

export default function SettingsFrame({ title, children }: SettingsFrameProps) {
  return (
    <ScreenContainer>
      <AppHeader title={title} back />
      <View style={{ gap: spacing.lg }}>{children}</View>
    </ScreenContainer>
  );
}
export function useSettingsAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function run(action: () => Promise<void | boolean>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await action();
      setMessage(result === false ? 'Cancelled. No records changed.' : 'Saved locally.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The operation failed. No data was reset.',
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, run };
}

export function PreferenceToggle({ label, value, disabled, onChange }: PreferenceToggleProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">
        {label}: {value ? 'On' : 'Off'}
      </AppText>
      <AppButton
        label={`${value ? 'Disable' : 'Enable'} ${label.toLowerCase()}`}
        disabled={disabled}
        variant="secondary"
        onPress={() => onChange(!value)}
      />
    </View>
  );
}
