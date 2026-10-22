/** Device authentication is an access gate only. This service never sees a Vault key. */
export function createAppLockService(
  authenticate: () => Promise<void>,
  clock: () => number = () => performance.now(),
) {
  let state = { locked: true, busy: false };
  let generation = 0;
  let enabled = false;
  let seconds = 60;
  let touched = 0;
  const listeners: Set<() => void> = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  const service = {
    getState: () => state,
    inspect: () => ({
      enabled,
      seconds,
      idleMs: clock() - touched,
      generation,
      locked: state.locked,
    }),
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    configure(value: boolean, timeout: number) {
      if (enabled !== value) service.lock();
      enabled = value;
      seconds = timeout;
    },
    lock() {
      generation++;
      state = { ...state, locked: true };
      emit();
    },
    touch() {
      touched = clock();
    },
    check() {
      if (enabled && !state.locked && clock() - touched >= seconds * 1000) service.lock();
    },
    async unlock() {
      if (state.busy) throw new Error('Device authentication is already running.');
      const ticket = generation;
      state = { ...state, busy: true };
      emit();
      try {
        await authenticate();
        if (ticket !== generation) throw new Error('App was backgrounded. Authenticate again.');
        touched = clock();
        state = { ...state, locked: false };
      } finally {
        state = { ...state, busy: false };
        emit();
      }
    },
  };
  return service;
}
