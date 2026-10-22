/** A retired generation cannot accept a late service write after cutover.
Active transactions drain before connection closure. */
export function guardDatabase(db: import('expo-sqlite').SQLiteDatabase) {
  let accepting = true;
  let count = 0;
  let waiters: (() => void)[] = [];
  const proxy = new Proxy(db, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof value !== 'function') return value;
      if (!String(key).endsWith('Async')) return value.bind(target);
      return async (...args: unknown[]) => {
        if (!accepting) throw new Error('Storage is reopening. Return to the library and retry.');
        count++;
        try {
          return await value.apply(target, args);
        } finally {
          if (--count === 0) {
            waiters.forEach((fn) => fn());
            waiters = [];
          }
        }
      };
    },
  });
  return {
    db: proxy,
    async retire() {
      accepting = false;
      if (count) await new Promise((resolve) => waiters.push(() => resolve(undefined)));
    },
  };
}
const hooks: Set<() => Promise<void>> = new Set();

export function registerStoragePause(pause: () => Promise<void>) {
  hooks.add(pause);
  return () => {
    hooks.delete(pause);
  };
}
export async function pauseStorageConsumers() {
  await Promise.all([...hooks].map((pause) => pause()));
}
