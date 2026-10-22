import { useCallback, useEffect, useState } from 'react';
import { Stack, useFocusEffect } from 'expo-router';
import ScreenContainer from '../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../components/layout/AppHeader.tsx';
import AppText from '../../components/ui/AppText.tsx';
import { useVault } from '../../features/vault/providers/VaultProvider.tsx';
import VaultGate from '../../features/vault/components/VaultGate.tsx';
import { acquireVaultScreen } from '../../services/security/vaultScreen.native.ts';
export const unstable_settings = { anchor: 'index' };
export default function VaultLayout() {
  const { service, state } = useVault();
  const [protectedScreen, setProtected] = useState(null as typeof service | null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const protection = acquireVaultScreen();
    protection.ready
      .then(() => {
        if (active) setProtected(service);
      })
      .catch(() =>
        setError(
          'Screen protection is unavailable. Vault forms are blocked. Rebuild the Android app.',
        ),
      );
    return () => {
      active = false;
      service.lock();
      protection.release();
    };
  }, [service]);
  useFocusEffect(useCallback(() => () => service.lock(), [service]));
  if (protectedScreen !== service)
    return (
      <ScreenContainer>
        <AppHeader title="Vault" back />
        <AppText>{error || 'Preparing protected screen…'}</AppText>
      </ScreenContainer>
    );
  if (!state.ready || state.locked) return <VaultGate key={state.generation} />;
  return <Stack key={state.generation} screenOptions={{ headerShown: false, animation: 'none' }} />;
}
