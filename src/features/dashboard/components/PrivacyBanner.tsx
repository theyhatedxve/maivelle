import { Pressable, View, useWindowDimensions } from 'react-native';
import { ArrowRight, LockKeyhole } from 'lucide-react-native';
import { router } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { useDashboardStyles } from './dashboardStyles.ts';

export default function PrivacyBanner() {
  const styles = useDashboardStyles();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  return (
    <View style={styles.banner}>
      <AppText variant="caption" tone="accent">
        YOUR PRIVACY MATTERS
      </AppText>
      <View style={styles.bannerBody}>
        <View style={styles.bannerCopy}>
          <AppText style={styles.bannerTitle}>Secure today, free tomorrow.</AppText>
          <AppText variant="caption" tone="muted">
            Your everyday stays on this device. Vault credentials and exported backups have their
            own encryption.
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings/security')}
            style={styles.privacyAction}
          >
            <AppText variant="label" tone="onPrimary">
              Learn more
            </AppText>
            <ArrowRight color={colors.onPrimary} size={18} accessible={false} />
          </Pressable>
        </View>
        {width >= 360 && fontScale <= 1.3 ? (
          <View
            style={styles.shield}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Svg width="92" height="112" viewBox="0 0 92 112">
              <Defs>
                <LinearGradient id="dashboard-shield" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#E7D4FF" />
                  <Stop offset="0.5" stopColor="#AB76F4" />
                  <Stop offset="1" stopColor="#6932CD" />
                </LinearGradient>
              </Defs>
              <Circle
                cx="46"
                cy="55"
                r="43"
                fill="none"
                stroke={colors.surface}
                strokeWidth="1.5"
              />
              <Circle
                cx="46"
                cy="55"
                r="34"
                fill="none"
                stroke={colors.surface}
                strokeOpacity="0.7"
              />
              <Path
                d="M46 18 L73 29 V53 C73 74 59 88 46 96 C33 88 19 74 19 53 V29Z"
                fill="url(#dashboard-shield)"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </Svg>
            <View style={{ position: 'absolute' }}>
              <LockKeyhole size={31} color="#FFFFFF" strokeWidth={2.2} accessible={false} />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
