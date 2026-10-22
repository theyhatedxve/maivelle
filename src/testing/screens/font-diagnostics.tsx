import { Redirect } from 'expo-router';
import { useState } from 'react';
import { PixelRatio, Text, useWindowDimensions } from 'react-native';
import ScreenContainer from '../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../components/layout/AppHeader.tsx';
import AppText from '../../components/ui/AppText.tsx';
import { useTheme } from '../../theme/ThemeProvider.tsx';
/** Read-only public text metrics; no global scaling overrides or native layout workarounds. */
export default function FontDiagnostics() {
  const { fontScale } = useWindowDimensions();
  const { colors } = useTheme();
  const [themed, setThemed] = useState('waiting');
  const [native, setNative] = useState('waiting');
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScreenContainer>
      <AppHeader title="Font scaling diagnostics" back />
      <AppText>JS font scale: {fontScale}</AppText>
      <AppText>PixelRatio font scale: {PixelRatio.getFontScale()}</AppText>
      <AppText
        variant="title"
        onTextLayout={(event) => {
          const line = event.nativeEvent.lines[0];
          if (line) setThemed(`${line.width.toFixed(2)} x ${line.height.toFixed(2)}`);
        }}
      >
        Maivelle Aa 012345
      </AppText>
      <AppText>Themed line: {themed}</AppText>
      <Text
        style={{ fontSize: 24, color: colors.text }}
        onTextLayout={(event) => {
          const line = event.nativeEvent.lines[0];
          if (line) setNative(`${line.width.toFixed(2)} x ${line.height.toFixed(2)}`);
        }}
      >
        Maivelle Aa 012345
      </Text>
      <AppText>Native line: {native}</AppText>
      <AppText>
        Both samples use normal system font scaling. This diagnostic never changes your preference.
        Compare live changes with cold starts; JS dimension events and native text measurements are
        separate observations.
      </AppText>
    </ScreenContainer>
  );
}
