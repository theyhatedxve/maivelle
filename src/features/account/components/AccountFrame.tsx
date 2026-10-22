import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WelcomeBackdrop from '../../welcome/components/WelcomeBackdrop.tsx';
import { accountStyles as styles } from './accountStyles.ts';
import { acquireVaultScreen } from '../../../services/security/vaultScreen.native.ts';
import { AccountLayoutContext } from './AccountLayout.tsx';

type Props = PropsWithChildren<{ title: string; subtitle: string; onBack?: () => void }>;

export default function AccountFrame({ title, subtitle, onBack, children }: Props) {
  const [protection, setProtection] = useState<'loading' | 'ready' | 'error'>('loading');
  const [typing, setTyping] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(0);
  const { height, fontScale } = useWindowDimensions();
  const compressed = typing || (availableHeight > 0 && availableHeight < 780) || fontScale > 1.25;
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setTyping(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setTyping(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  useEffect(() => {
    let active = true;
    const lease = acquireVaultScreen();
    lease.ready
      .then(() => {
        if (active) setProtection('ready');
      })
      .catch(() => {
        if (active) setProtection('error');
      });
    return () => {
      active = false;
      lease.release();
    };
  }, []);
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <WelcomeBackdrop />
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={styles.viewport}
            onLayout={({ nativeEvent }) => setAvailableHeight(nativeEvent.layout.height)}
          >
            <AccountLayoutContext.Provider value={{ compressed, typing }}>
              <View style={styles.content}>
                {!typing ? (
                  <View style={styles.header}>
                    <View style={styles.navigation}>
                      {onBack ? (
                        <Pressable
                          onPress={onBack}
                          accessibilityRole="button"
                          accessibilityLabel="Back"
                          style={styles.back}
                        >
                          <ArrowLeft size={24} color="#24105C" accessible={false} />
                        </Pressable>
                      ) : null}
                    </View>
                    <Image
                      source={require('../../../../assets/branding/maivelle-logo.png')}
                      resizeMode="contain"
                      style={[
                        styles.logo,
                        { height: Math.min(compressed ? 76 : 118, height * 0.15) },
                      ]}
                      accessible
                      accessibilityLabel="Maivelle"
                    />
                    <Text style={styles.title} accessibilityRole="header">
                      {title}
                    </Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => Keyboard.dismiss()}
                    accessibilityRole="button"
                    style={styles.dismissKeyboard}
                  >
                    <Text style={styles.linkText}>Done typing</Text>
                  </Pressable>
                )}
                <View style={[styles.panel, compressed && styles.panelCompact]}>
                  {protection === 'ready' ? (
                    children
                  ) : (
                    <Text style={styles.message}>
                      {protection === 'error'
                        ? 'Screen protection is unavailable. Reopen Maivelle before entering credentials.'
                        : 'Preparing private entry…'}
                    </Text>
                  )}
                </View>
                {!typing ? <Text style={styles.footer}>PRIVATE · PERSONAL · LOCAL</Text> : null}
              </View>
            </AccountLayoutContext.Provider>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
