import AppButton from '../../../components/ui/AppButton.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import { useSettingsAction } from '../../settings/components/SettingsFrame.tsx';
import { useLocalAccount } from '../providers/LocalAccountProvider.tsx';

export default function LocalProfileSettings() {
  const { state, service } = useLocalAccount();
  const action = useSettingsAction();
  if (!state.profile) return null;
  return (
    <>
      <AppText variant="heading">Your local profile</AppText>
      <AppText>
        {state.profile.name} · @{state.profile.nickname}
      </AppText>
      <AppText tone="muted">
        PIN unlock is required after reopening or backgrounding. Idle PIN locking is optional.
        Signing out keeps your records and requires your username and password next time. Vault
        authorization remains separate.
      </AppText>
      <AppButton
        label="Lock Maivelle now"
        variant="secondary"
        onPress={() => service.lock()}
        disabled={state.busy}
      />
      <AppButton
        label="Sign out of local profile"
        variant="secondary"
        disabled={state.busy || action.busy}
        onPress={() => {
          void action.run(() => service.signOut());
        }}
      />
      {action.message ? <AppText accessibilityLiveRegion="polite">{action.message}</AppText> : null}
    </>
  );
}
