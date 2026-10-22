import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'lucide-react-native';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BrandButton from '../../../components/branding/BrandButton.tsx';
import { useLocalAccount } from '../../account/providers/LocalAccountProvider.tsx';
import { useSettings } from '../../settings/providers/SettingsProvider.tsx';
import { welcomePages, welcomeValues } from '../model/welcomeContent.ts';
import WelcomeBackdrop from './WelcomeBackdrop.tsx';
import { welcomeStyles as styles } from './welcomeStyles.ts';

const logo = require('../../../../assets/branding/maivelle-logo.png');

export default function WelcomeScreen() {
  const { save } = useSettings();
  const { state: account } = useLocalAccount();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = height - insets.top - insets.bottom;
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const compact = width < 360 || availableHeight < 700 || fontScale > 1.25;
  const content = welcomePages[page];

  // A repeated visit from About starts at the introduction again.
  useFocusEffect(
    useCallback(() => {
      setPage(0);
    }, []),
  );

  function showPage(next: number) {
    setPage(next);
  }

  async function getStarted() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await save('welcomeCompleted', true);
      router.replace(account.profile ? '/' : '/sign-up');
    } catch {
      setError('Could not save your introduction preference. Please try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <WelcomeBackdrop />
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.viewport, compact && styles.viewportCompact]}>
          <View style={styles.content}>
            <View style={[styles.hero, compact && styles.heroCompact]}>
              <Image
                source={logo}
                resizeMode="contain"
                style={[styles.logo, { maxHeight: availableHeight * (page === 0 ? 0.25 : 0.16) }]}
                accessible
                accessibilityLabel="Maivelle"
              />
              <Text style={styles.tagline} accessibilityRole="header">
                {content.title}
              </Text>
              {content.description ? (
                <Text style={styles.description} accessibilityLiveRegion="polite">
                  {content.description}
                </Text>
              ) : null}
            </View>

            <View style={[styles.bottom, compact && styles.bottomCompact]}>
              <View style={[styles.values, compact && styles.valuesCompact]}>
                {welcomeValues.map(({ title, description, icon: Icon }, index) => (
                  <View key={title} style={[styles.value, index > 0 && styles.verticalDivider]}>
                    <View style={styles.iconBadge}>
                      <Icon size={25} color="#6D42C7" strokeWidth={1.8} accessible={false} />
                    </View>
                    <View>
                      <Text style={styles.valueTitle}>{title}</Text>
                      {!compact ? <Text style={styles.valueDescription}>{description}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.actions}>
                {error ? (
                  <Text style={styles.error} accessibilityRole="alert">
                    {error}
                  </Text>
                ) : null}
                <BrandButton
                  label={saving ? 'Opening your space…' : 'Get started'}
                  busy={saving}
                  onPress={() => {
                    void getStarted();
                  }}
                />
                <Pressable
                  onPress={() => showPage(page < welcomePages.length - 1 ? page + 1 : 0)}
                  disabled={saving}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.65 : 1 }]}
                >
                  {page === welcomePages.length - 1 ? (
                    <ArrowLeft size={18} color="#5B2AB5" accessible={false} />
                  ) : null}
                  <Text style={styles.secondaryLabel}>
                    {page === 0 ? 'Learn more' : page === 1 ? 'Your privacy' : 'Back to welcome'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.pagination} accessibilityLabel="Introduction pages">
                {welcomePages.map((item, index) => (
                  <Pressable
                    key={item.title}
                    onPress={() => showPage(index)}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel={`Introduction page ${index + 1} of ${welcomePages.length}`}
                    accessibilityState={{ selected: index === page, disabled: saving }}
                    style={styles.dotTarget}
                  >
                    <View style={[styles.dot, index === page && styles.activeDot]} />
                  </Pressable>
                ))}
              </View>
              <Text style={styles.footer}>PRIVATE · PERSONAL · LOCAL</Text>
              {page === 2 && __DEV__ ? (
                <Text style={styles.developmentNote}>
                  Development preview: production database encryption approval is still pending. Use
                  fictional sensitive records.
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
