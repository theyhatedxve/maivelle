import { useState, useSyncExternalStore } from 'react';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import VaultField from './VaultField.tsx';
import { useVault } from '../providers/VaultProvider.tsx';
import VaultRecovery from './VaultRecovery.tsx';
import { recoveryFiles } from '../services/vaultFiles.native.ts';
export default function VaultGate() {
  const { service, state } = useVault();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ack, setAck] = useState(false);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false);
  const selected = useSyncExternalStore(
    recoveryFiles.subscribe,
    recoveryFiles.get,
    recoveryFiles.get,
  );

  async function submit(biometric: boolean = false) {
    setError('');
    const supplied = password;
    setPassword('');
    setConfirm('');
    try {
      if (biometric) await service.unlockBiometrics();
      else if (state.configured) await service.unlock(supplied);
      else {
        if (supplied !== confirm || !ack)
          throw new Error('Confirm the matching master password and acknowledge recovery limits.');
        await service.setup(supplied);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Vault operation failed.');
    }
  }
  return (
    <ScreenContainer>
      <AppHeader title="Vault" back />
      <AppText variant="heading">
        {state.configured ? 'Unlock your Vault' : 'Set up your Vault'}
      </AppText>
      <AppText tone="muted">
        Development build · Fictional credentials only. Encrypted Vault payloads do not make the
        rest of this development database encrypted or production-ready.
      </AppText>
      {!state.ready ? (
        <>
          <AppText>Vault metadata is unavailable or still loading.</AppText>
          <AppButton
            label="Retry Vault metadata"
            onPress={() => {
              service
                .refresh()
                .catch(() =>
                  setError('Vault metadata is damaged or unavailable. No data was reset.'),
                );
            }}
          />
        </>
      ) : (recovery || !!selected) && !state.configured ? (
        <VaultRecovery
          onCancel={() => {
            recoveryFiles.clear();
            setRecovery(false);
          }}
        />
      ) : (
        <>
          <VaultField
            label="Master password"
            value={password}
            onChange={setPassword}
            secret
            editable={!state.busy}
          />
          {!state.configured && (
            <>
              <VaultField
                label="Confirm master password"
                value={confirm}
                onChange={setConfirm}
                secret
                editable={!state.busy}
              />
              <AppText>
                No password reset is available. Losing the master password and all usable encrypted
                backups can permanently lose access.
              </AppText>
              <AppButton
                label={ack ? 'Recovery warning acknowledged' : 'I understand the recovery limits'}
                variant="secondary"
                disabled={state.busy}
                onPress={() => setAck(!ack)}
              />
            </>
          )}
          <AppButton
            label={
              state.busy ? 'Deriving securely…' : state.configured ? 'Unlock Vault' : 'Create Vault'
            }
            disabled={state.busy}
            onPress={() => {
              void submit();
            }}
          />
          {state.configured && (
            <AppButton
              label="Unlock with strong biometrics"
              variant="secondary"
              disabled={state.busy}
              onPress={() => {
                void submit(true);
              }}
            />
          )}
          {!state.configured && (
            <AppButton
              label="Recover from encrypted backup"
              variant="secondary"
              disabled={state.busy}
              onPress={() => setRecovery(true)}
            />
          )}
        </>
      )}
      {!!error && <AppText accessibilityLiveRegion="polite">{error}</AppText>}
    </ScreenContainer>
  );
}
