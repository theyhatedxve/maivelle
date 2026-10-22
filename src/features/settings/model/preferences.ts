export type Preferences = {
  localPinIdleLock: boolean;
  localProfileCreated: boolean;
  welcomeCompleted: boolean;
  appearance: 'light' | 'dark' | 'system';
  appLock: boolean;
  inactivitySeconds: number;
  protectScreens: boolean;
  medicineReminders: boolean;
  confirmExternalBackup: boolean;
};
export const preferenceDefaults = Object.freeze({
  localPinIdleLock: false,
  localProfileCreated: false,
  welcomeCompleted: false,
  appearance: 'system',
  appLock: false,
  inactivitySeconds: 60,
  protectScreens: false,
  medicineReminders: true,
  confirmExternalBackup: true,
});

export function validatePreference(key: string, value: unknown) {
  if (!Object.hasOwn(preferenceDefaults, key)) throw new Error('Unknown preference.');
  if (key === 'appearance') {
    if (!['light', 'dark', 'system'].includes(value as string))
      throw new Error('Choose Light, Dark or System.');
  } else if (key === 'inactivitySeconds') {
    if (![60, 300].includes(value as number)) throw new Error('Choose 1 or 5 minutes.');
  } else if (typeof value !== 'boolean') throw new Error('Invalid preference value.');
  return value;
}
