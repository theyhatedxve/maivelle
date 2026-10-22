let sequence = 0;
let queue = Promise.resolve();
export function acquireVaultScreen() {
  const token = `maivelle-vault-${++sequence}`;
  const capture = require('expo-screen-capture') as typeof import('expo-screen-capture');
  const ready = queue.then(() => capture.preventScreenCaptureAsync(token));
  // Keep sequencing alive after a failure; the original rejection blocks the caller's forms.
  queue = ready.catch(() => {});
  let released = false;
  return {
    ready,
    release() {
      if (released) return;
      released = true;
      queue = queue
        .then(() => capture.allowScreenCaptureAsync(token))
        .catch(() => {
          console.warn(
            '[Vault] Screen protection cleanup failed; restart may be needed to allow screenshots.',
          );
        });
    },
  };
}
