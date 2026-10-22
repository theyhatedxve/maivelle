import { Redirect } from 'expo-router';
import { useState } from 'react';
import ScreenContainer from '../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../components/layout/AppHeader.tsx';
import AppText from '../../components/ui/AppText.tsx';
import AppButton from '../../components/ui/AppButton.tsx';
export default function VaultDiagnostics() {
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState('Ready. Isolated fictional fixtures only.');
  if (!__DEV__) return <Redirect href="/" />;
  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const { runNativeVaultChecks } = require('../vault/nativeVaultChecks.ts');
      const results = await runNativeVaultChecks(setOutput);
      setOutput(results.join('\n'));
    } catch (error) {
      setOutput(
        `FAILED: ${error instanceof Error ? error.message : 'Native Vault checks failed.'}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScreenContainer>
      <AppHeader title="Native Vault diagnostics" back />
      <AppText>
        Development only. Synthetic, isolated databases. No application Vault records are changed.
        Full-cost native KDF checks take time.
      </AppText>
      <AppButton
        label={busy ? 'Running native Vault checks…' : 'Run native Vault checks'}
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
