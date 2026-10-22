import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import ScreenContainer from '../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../components/layout/AppHeader.tsx';
import AppText from '../../components/ui/AppText.tsx';
import AppButton from '../../components/ui/AppButton.tsx';
export default function StorageSecurityCheck() {
  const [output, setOutput] = useState(
    'Ready. Disposable encrypted database and separate SecureStore namespace only.',
  );
  const busy = useRef(false);
  const runRecoveryCheck = (stage: string) => {
    if (busy.current) return;
    busy.current = true;
    setOutput('Running disposable recovery check...');
    void (async () => {
      try {
        const checks = await import('../database/productionInterruptionChecks.ts');
        if (stage === 'verify') setOutput(await checks.verifyProductionInterruption());
        else if (stage === 'keyloss') setOutput(await checks.runProductionKeyLossCheck());
        else await checks.prepareProductionInterruption(stage, setOutput);
      } catch (error) {
        const reason =
          error instanceof Error
            ? error.message.replace(/[0-9a-f]{64,}/gi, '[redacted]')
            : 'Unknown recovery error';
        setOutput(
          `FAILED: ${reason}. Checkpoint retained for inspection. No live storage was changed.`,
        );
      } finally {
        busy.current = false;
      }
    })();
  };
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScreenContainer>
      <AppHeader title="Encrypted storage diagnostics" back />
      <AppText>
        Production storage remains disabled. This explicit probe never opens, migrates or rekeys
        application databases.
      </AppText>
      <AppButton
        label="Run disposable SQLCipher checks"
        onPress={() => {
          void (async () => {
            if (busy.current) return;
            busy.current = true;
            setOutput('Running disposable encryption checks…');
            try {
              const { runNativeEncryptedChecks } =
                await import('../database/nativeEncryptedChecks.ts');
              setOutput((await runNativeEncryptedChecks()).join('\n'));
            } catch (error) {
              setOutput(
                `FAILED: ${error instanceof Error ? error.message : 'Encrypted probe failed'}`,
              );
            } finally {
              busy.current = false;
            }
          })();
        }}
      />
      <AppText selectable accessibilityLiveRegion="polite">
        {output}
      </AppText>
      <AppButton
        label="Run Stage 13A integration checks"
        onPress={() => {
          if (busy.current) return;
          busy.current = true;
          void (async () => {
            try {
              const { runNativeStage13AChecks } =
                await import('../database/nativeStage13AChecks.ts');
              const rows = await runNativeStage13AChecks(setOutput);
              setOutput(
                [...rows, 'PASS: Stage 13A isolated integration fixtures cleaned'].join('\n'),
              );
            } catch {
              setOutput(
                (previous) =>
                  previous +
                  '\nFAILED: Stage 13A isolated integration. Inspect private development error locally; no live storage was changed.',
              );
            } finally {
              busy.current = false;
            }
          })();
        }}
      />
      <AppButton
        label="Run production provisioning candidate checks"
        onPress={() => {
          void (async () => {
            if (busy.current) return;
            busy.current = true;
            setOutput('Running disposable production provisioning candidate…');
            try {
              const { runNativeProductionChecks } =
                await import('../database/nativeProductionChecks.ts');
              const rows = await runNativeProductionChecks(setOutput);
              setOutput(
                [...rows, 'PASS: production candidate fixtures and protected keys cleaned'].join(
                  '\n',
                ),
              );
            } catch (error) {
              setOutput(
                (previous) =>
                  previous +
                  '\nFAILED: ' +
                  (error instanceof Error
                    ? error.message.replace(/[0-9a-f]{64,}/gi, '[redacted]')
                    : 'Production provisioning candidate failed.'),
              );
            } finally {
              busy.current = false;
            }
          })();
        }}
      />
      <AppButton
        label="Prepare first provisioning interruption"
        onPress={() => runRecoveryCheck('first')}
      />
      <AppButton
        label="Prepare replacement interruption"
        onPress={() => runRecoveryCheck('replace')}
      />
      <AppButton
        label="Prepare published selection interruption"
        onPress={() => runRecoveryCheck('published')}
      />
      <AppButton
        label="Verify interruption and clean fixture"
        onPress={() => runRecoveryCheck('verify')}
      />
      <AppButton
        label="Test explicit lost-key portable recovery"
        onPress={() => runRecoveryCheck('keyloss')}
      />
    </ScreenContainer>
  );
}
