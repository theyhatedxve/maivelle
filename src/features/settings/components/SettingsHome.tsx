import { router } from 'expo-router';
import { Palette, ShieldCheck, Bell, Archive, HardDrive, Info } from 'lucide-react-native';
import SettingsFrame from './SettingsFrame.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import AppText from '../../../components/ui/AppText.tsx';
export default function SettingsHome() {
  return (
    <SettingsFrame title="Settings">
      <AppText tone="muted">
        Your preferences stay on this device. No account or internet connection is required.
      </AppText>
      <AppButton
        label="Appearance"
        icon={Palette}
        variant="secondary"
        onPress={() => router.push('/settings/appearance')}
      />
      <AppButton
        label="Privacy and Security"
        icon={ShieldCheck}
        variant="secondary"
        onPress={() => router.push('/settings/security')}
      />
      <AppButton
        label="Notifications"
        icon={Bell}
        variant="secondary"
        onPress={() => router.push('/settings/notifications')}
      />
      <AppButton
        label="Backup and Restore"
        icon={Archive}
        variant="secondary"
        onPress={() => router.push('/settings/backup')}
      />
      <AppButton
        label="Storage Information"
        icon={HardDrive}
        variant="secondary"
        onPress={() => router.push('/settings/storage')}
      />
      <AppButton
        label="About Maivelle"
        icon={Info}
        variant="secondary"
        onPress={() => router.push('/settings/about')}
      />
    </SettingsFrame>
  );
}
