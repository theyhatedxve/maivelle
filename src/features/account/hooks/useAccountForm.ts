import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/** Clear secret fields on background/unmount; JS strings cannot be guaranteed zeroized. */
export function useAccountForm() {
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setPassword('');
        setPin('');
        setError('');
      }
    });
    return () => {
      active.current = false;
      subscription.remove();
    };
  }, []);
  async function run(work: () => Promise<void>) {
    setError('');
    try {
      await work();
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error ? failure.message : 'Unable to complete local authentication.',
        );
    } finally {
      if (active.current) {
        setPassword('');
        setPin('');
      }
    }
  }
  return { password, setPassword, pin, setPin, error, run };
}
