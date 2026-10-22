/** Resolve cancellation/dismissal before any authentication or storage work.
The native alert presenter is injected so the exact decision boundary is testable. */
export function confirmReplacement(
  showAlert: (
    title: string,
    message: string,
    buttons: {
      text: string;
      style: 'cancel' | 'destructive';
      onPress: () => void;
    }[],
    options: {
      cancelable: boolean;
      onDismiss: () => void;
    },
  ) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    showAlert(
      'Replace current Maivelle records?',
      'This replaces all supported module records without merging. The current database remains a local recovery point. Device app lock must be re-enabled and biometrics re-provisioned. Continue only after reviewing the preview.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Replace records',
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
