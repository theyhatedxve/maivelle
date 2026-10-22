import { Redirect } from 'expo-router';
import ScreenContainer from '../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../components/layout/AppHeader.tsx';
import AppText from '../../components/ui/AppText.tsx';
import AppButton from '../../components/ui/AppButton.tsx';
import { useEffect, useState } from 'react';
export default function VaultSecurityCheck() {
  const [result, setResult] = useState('Ready. No automatic crypto execution.');
  const [busy, setBusy] = useState(false);
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    if (!__DEV__) return;
    const timer = setInterval(() => setTicks((value) => value + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  async function run(operation: 'load' | 'random' | 'aes' | 'kdf' | 'scheduler' | 'error') {
    if (!__DEV__ || busy) return;
    setBusy(true);
    setResult(`Starting ${operation}`);
    // Paint the stage before entering a synchronous native module loader.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const started = performance.now();
    console.info(`[Vault diagnostic] BEGIN ${operation}`);
    try {
      if (operation === 'error') throw new Error('Expected public-fixture diagnostic failure.');
      const crypto = require('expo-crypto') as typeof import('expo-crypto');
      if (operation === 'scheduler') {
        const { scryptAsync } = require('@noble/hashes/scrypt.js');
        let timerFired = false;
        const timer = setTimeout(() => {
          timerFired = true;
        }, 0);
        // Small public fixture only: reproduce scheduling without a full-cost UI-thread KDF.
        const bytes = await scryptAsync('', '', {
          N: 1024,
          r: 1,
          p: 1,
          dkLen: 32,
          asyncTick: 0,
        });
        bytes.fill(0);
        clearTimeout(timer);
        console.info(`[Vault diagnostic] Noble timer ran during KDF: ${timerFired}`);
        if (timerFired) throw new Error('Expected microtask starvation was not reproduced');
      }
      if (operation === 'random') {
        const bytes = await crypto.getRandomBytesAsync(32);
        if (bytes.length !== 32 || !bytes.some((byte) => byte !== 0))
          throw new Error('Random API result invalid');
        bytes.fill(0);
      }
      if (operation === 'aes' || operation === 'kdf') {
        const { verifyVaultAes, verifyVaultKdf } =
          require('../../services/security/vaultCryptoGate.ts') as typeof import('../../services/security/vaultCryptoGate.ts');
        const results = await (operation === 'aes' ? verifyVaultAes : verifyVaultKdf)((stage) => {
          setResult(`Running ${stage}`);
          console.info(`[Vault diagnostic] ${stage}`);
        });
        results.forEach((label) => console.info(`[Vault diagnostic] ${label}`));
      }
      const message = `PASS ${operation}: ${Math.round(performance.now() - started)} ms`;
      console.info(`[Vault diagnostic] ${message}`);
      setResult(message);
    } catch (error) {
      // Public fixtures only. Never include crypto inputs, keys or payloads in logs.
      setResult(`FAIL ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.info(`[Vault diagnostic] FAIL ${operation}`);
    } finally {
      setBusy(false);
    }
  }
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScreenContainer>
      <AppHeader title="Vault security gate" back />
      <AppText variant="heading">Isolated crypto diagnostics revision 3</AppText>
      <AppText>JS heartbeat: {ticks}</AppText>
      <AppText>{result}</AppText>
      <AppButton
        label="Load library only"
        disabled={busy}
        onPress={() => {
          void run('load');
        }}
      />
      <AppButton
        label="Test native randomness"
        disabled={busy}
        onPress={() => {
          void run('random');
        }}
      />
      <AppButton
        label="Test authenticated encryption"
        disabled={busy}
        onPress={() => {
          void run('aes');
        }}
      />
      <AppButton
        label="Check bounded KDF scheduling"
        disabled={busy}
        onPress={() => {
          void run('scheduler');
        }}
      />
      <AppButton
        label="Test native background KDF"
        disabled={busy}
        onPress={() => {
          void run('kdf');
        }}
      />
      <AppButton
        label="Test diagnostic failure recovery"
        disabled={busy}
        variant="secondary"
        onPress={() => {
          void run('error');
        }}
      />
      <AppText>
        Public fixtures only. Each operation runs only when selected. Normal startup does not invoke
        this diagnostic. No credentials are stored.
      </AppText>
      <AppText tone="muted">
        The Vault remains unavailable. Background native key derivation requires the rebuilt Android
        binary. Existing data is preserved.
      </AppText>
    </ScreenContainer>
  );
}
