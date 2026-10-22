import { Redirect } from 'expo-router';
import { useRef, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../components/layout/AppHeader.tsx';
import AppText from '../../components/ui/AppText.tsx';
import AppButton from '../../components/ui/AppButton.tsx';
import { BackupScreen } from '../../features/settings/components/BackupSettings.tsx';

export type SandboxScreenProps = {
  sandbox: Awaited<
    ReturnType<typeof import('../database/restoreSandbox.native.ts').createRestoreSandbox>
  >;
};

export default function RestoreUiDiagnostics() {
  const [sandbox, setSandbox] = useState(
    null as Awaited<
      ReturnType<typeof import('../database/restoreSandbox.native.ts').createRestoreSandbox>
    > | null,
  );
  const [message, setMessage] = useState('Ready. Explicit disposable environment only.');
  const busy = useRef(false);
  if (!__DEV__) return <Redirect href="/" />;
  if (sandbox) return <SandboxScreen sandbox={sandbox} />;
  return (
    <ScreenContainer>
      <AppHeader title="Isolated restore UI" back />
      <AppText>
        No live storage replacement. This creates fictional records under a separate journal and
        uses real Android pickers and authentication.
      </AppText>
      <AppButton
        label="Create disposable UI sandbox"
        onPress={() => {
          void (async () => {
            if (busy.current) return;
            busy.current = true;
            try {
              const { createRestoreSandbox } =
                await import('../database/restoreSandbox.native.ts');
              setSandbox(await createRestoreSandbox(setMessage));
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Sandbox setup failed');
            } finally {
              busy.current = false;
            }
          })();
        }}
      />
      <AppText>{message}</AppText>
    </ScreenContainer>
  );
}

function SandboxScreen({ sandbox }: SandboxScreenProps) {
  const insets = useSafeAreaInsets();
  const state = useSyncExternalStore(sandbox.subscribe, sandbox.getState, sandbox.getState);
  const [error, setError] = useState('');
  const [toolsVisible, setToolsVisible] = useState(false);
  async function run(action: () => Promise<void>) {
    try {
      await action();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sandbox action failed');
    }
  }
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <AppText accessibilityLiveRegion="polite">Disposable UI sandbox — {state.message}</AppText>
      {!state.closed ? (
        <>
          <AppButton
            label={toolsVisible ? 'Hide sandbox tools' : 'Show sandbox tools'}
            onPress={() => setToolsVisible(!toolsVisible)}
          />
          {toolsVisible ? (
            <>
              <AppText>
                Public test backup passphrase: PublicPhase13UiBackup2026. Public Vault master:
                PublicPhase13UiVault2026.
              </AppText>
              <AppButton
                label="Modify disposable marker"
                onPress={() => {
                  void run(sandbox.changeMarker);
                }}
              />
              <AppButton
                label="Export deliberately corrupted fixture"
                onPress={() => {
                  void run(sandbox.exportCorruptedFixture);
                }}
              />
              <AppButton label="Inject next isolated cutover failure" onPress={sandbox.failNext} />
              <AppButton
                label="Inspect disposable marker"
                onPress={() => {
                  void run(sandbox.verifyCurrent);
                }}
              />
              <AppButton
                label="Clean disposable UI sandbox"
                onPress={() => {
                  void run(sandbox.cleanup);
                }}
              />
            </>
          ) : null}
          <BackupScreen
            key={state.generation}
            settings={sandbox.settings()}
            replaceDatabase={sandbox.replaceDatabase}
          />
        </>
      ) : null}
      <AppText>{error}</AppText>
    </View>
  );
}
