import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import ScreenContainer from '../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../components/layout/AppHeader.tsx';
import AppText from '../../components/ui/AppText.tsx';
import AppButton from '../../components/ui/AppButton.tsx';
import { useAppAccess } from '../../features/settings/providers/AppSecurityGate.tsx';
import { confirmReplacement } from '../../features/settings/services/replacementConfirmation.ts';
export default function SettingsDiagnostics() {
  const access = useAppAccess();
  const [accessState, setAccessState] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState('Ready. Isolated fictional records only.');
  if (!__DEV__) return <Redirect href="/" />;
  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const { runNativeSettingsChecks } =
        await import('../settings/nativeSettingsChecks.ts');
      const result = await runNativeSettingsChecks(setOutput);
      setOutput(result.join('\n'));
    } catch (error) {
      setOutput(
        (previous) =>
          previous +
          `\nFAILED: ${error instanceof Error ? error.message : 'Phase 12 diagnostics failed.'}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScreenContainer>
      <AppHeader title="Native Settings diagnostics" back />
      <AppText>
        Development only. Separate fictional databases, full-cost native KDF, encrypted files and an
        isolated restore journal. The application database and user Vault are never replaced.
      </AppText>
      <AppButton
        label="Inspect public app lock state"
        variant="secondary"
        onPress={() => setAccessState(JSON.stringify(access.inspect()))}
      />
      <AppText>{accessState}</AppText>
      <AppButton
        label="Test replacement confirmation only"
        variant="secondary"
        onPress={() => {
          void confirmReplacement(Alert.alert).then((confirmed) =>
            setConfirmation(
              confirmed
                ? 'Confirmation selected; diagnostic only, no storage action.'
                : 'Cancellation verified; no authentication or storage action.',
            ),
          );
        }}
      />
      <AppText>{confirmation}</AppText>
      <AppButton label="Lock app now" variant="secondary" onPress={() => access.lock()} />
      <AppButton
        label={busy ? 'Running native Settings checks…' : 'Run native Settings checks'}
        disabled={busy}
        onPress={() => {
          void run();
        }}
      />
      <AppText selectable accessibilityLiveRegion="polite">
        {output}
      </AppText>
    </ScreenContainer>
  );
}
