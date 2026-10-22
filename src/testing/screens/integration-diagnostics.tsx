import { Redirect } from 'expo-router';
import { useState, useRef } from 'react';
import ScreenContainer from '../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../components/layout/AppHeader.tsx';
import AppText from '../../components/ui/AppText.tsx';
import AppButton from '../../components/ui/AppButton.tsx';
import {
  runNativeIntegration,
  checkNativeLifecycle,
  inspectApplicationIntegrity,
} from '../database/nativePhase13.ts';
export default function IntegrationDiagnostics() {
  const [output, setOutput] = useState('Ready. Fictional isolated databases only.');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  if (!__DEV__) return <Redirect href="/" />;

  async function run(work: () => Promise<string>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      setOutput(await work());
    } catch (error) {
      setOutput('FAILED: ' + (error instanceof Error ? error.message : 'Integration check failed'));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <ScreenContainer>
      <AppHeader title="Phase 13 integration diagnostics" back />
      <AppText>
        Separate fictional fixtures. No application records, keys or restore selection are modified.
        Performance values are development observations.
      </AppText>
      <AppButton
        label="Inspect application integrity"
        disabled={busy}
        onPress={() => {
          void run(inspectApplicationIntegrity);
        }}
      />
      <AppButton
        label="Run cross-module checks"
        disabled={busy}
        onPress={() => {
          void run(() => runNativeIntegration('integration', setOutput));
        }}
      />
      <AppButton
        label="Measure isolated queries"
        disabled={busy}
        onPress={() => {
          void run(() => runNativeIntegration('performance', setOutput));
        }}
      />
      <AppButton
        label="Seed isolated lifecycle timer"
        disabled={busy}
        onPress={() => {
          void run(() => checkNativeLifecycle('seed'));
        }}
      />
      <AppButton
        label="Verify isolated lifecycle timer"
        disabled={busy}
        onPress={() => {
          void run(() => checkNativeLifecycle('verify'));
        }}
      />
      <AppButton
        label="Clean isolated lifecycle fixture"
        disabled={busy}
        onPress={() => {
          void run(() => checkNativeLifecycle('cleanup'));
        }}
      />
      <AppText selectable accessibilityLiveRegion="polite">
        {output}
      </AppText>
    </ScreenContainer>
  );
}
