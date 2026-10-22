/** App access uses Android-owned device authentication, never the Vault data key.
 * No app PIN, password verifier or Vault key is stored for this gate. */
export async function authenticateDevice() {
  const auth = await import('expo-local-authentication');
  if ((await auth.getEnrolledLevelAsync()) === auth.SecurityLevel.NONE)
    throw new Error('Set up a secure Android screen lock before enabling app lock.');
  const result = await auth.authenticateAsync({
    promptMessage: 'Authenticate for Maivelle',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    biometricsSecurityLevel: 'strong',
  });
  if (!result.success)
    throw new Error('Device authentication was not completed. Nothing was changed.');
}
