import { databaseName } from './storageControl.ts';
/** Replacement never overwrites a database file. Pending journal rolls back on process death. */
export async function cutoverDatabase(
  io: {
    control: ReturnType<typeof import('./storageControl.ts').createStorageControl>;
    close: () => Promise<void>;
    open: () => Promise<unknown>;
    verify: () => Promise<void>;
  },
  candidate: string,
) {
  databaseName(candidate);
  if (!candidate.startsWith('maivelle-restored-'))
    throw new Error('Only a verified staging generation may be installed.');
  const before = await io.control.read();
  if (before.active === candidate) throw new Error('Staging database is already active.');
  await io.close();
  try {
    await io.control.select(candidate, before.active, true);
    await io.open();
    await io.verify();
    await io.control.select(candidate, before.active, false);
  } catch (error) {
    try {
      await io.close();
      await io.control.select(before.active, candidate, false);
      await io.open();
    } catch {
      throw new Error(
        'Restore and automatic reopening failed. Restart Maivelle; both database generations are retained. Do not clear application data.',
      );
    }
    throw new Error(
      'Restore did not complete. The previous database was reopened; both generations are retained.',
      { cause: error },
    );
  }
}
