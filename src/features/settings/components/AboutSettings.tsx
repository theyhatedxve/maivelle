import SettingsFrame from './SettingsFrame.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import manifest from '../../../../package.json';
import { router } from 'expo-router';
import AppButton from '../../../components/ui/AppButton.tsx';
import { Image, StyleSheet, View } from 'react-native';
export default function AboutSettings() {
  return (
    <SettingsFrame title="About Maivelle">
      <View style={styles.brandPanel}>
        <Image
          source={require('../../../../assets/branding/maivelle-logo-slogan.png')}
          resizeMode="contain"
          style={styles.brand}
          accessible
          accessibilityLabel="Maivelle. Everything You Value, in One Place."
        />
      </View>
      <AppText variant="title">Maivelle · {manifest.version}</AppText>
      <AppText>Everything You Value, in One Place.</AppText>
      <AppButton
        label="View welcome screen"
        variant="secondary"
        onPress={() => router.push('/welcome')}
      />
      <AppText tone="muted">
        Offline Android personal management. Notes, Tasks, Calendar, Medicine Reminders, Time
        Tracker, Finance, Budget Divider and Password Vault.
      </AppText>
      <AppText>
        No cloud account, analytics or remote authentication. Android permissions and device
        security remain under your control.
      </AppText>
      <AppText tone="muted">
        Development build · Expo SDK 58. Production database key provisioning and independent
        security review are still required. Do not use real sensitive records.
      </AppText>
    </SettingsFrame>
  );
}

const styles = StyleSheet.create({
  brandPanel: { backgroundColor: '#F8F1FF', borderRadius: 18, padding: 16, alignItems: 'center' },
  brand: { width: '100%', maxWidth: 360, aspectRatio: 1456 / 1083 },
});
