import { Alert } from 'react-native';
/** Native confirmation dialogs take window focus, but an actual app-background event still locks. */
export function confirmVaultAction(
  service: import('../providers/VaultProvider.tsx').VaultService,
  {
    title,
    message,
    label,
    action,
  }: {
    title: string;
    message: string;
    label: string;
    action: () => void;
  },
) {
  const finish = service.beginConfirmation();
  Alert.alert(
    title,
    message,
    [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          finish();
        },
      },
      {
        text: label,
        style: 'destructive',
        onPress: () => {
          if (finish()) action();
        },
      },
    ],
    {
      cancelable: true,
      onDismiss: () => {
        finish();
      },
    },
  );
}
