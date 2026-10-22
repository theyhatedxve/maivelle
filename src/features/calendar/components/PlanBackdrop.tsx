import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../../../theme/ThemeProvider.tsx';

export default function PlanBackdrop() {
  const { colors, dark } = useTheme();
  const id = `plan-petal-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox="0 0 400 900" preserveAspectRatio="xMaxYMin slice">
        <Defs>
          <LinearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.background} />
            <Stop offset="0.55" stopColor={dark ? colors.background : '#F0EBFF'} />
            <Stop offset="1" stopColor={colors.background} />
          </LinearGradient>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.01" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={dark ? 0.14 : 0.2} />
          </LinearGradient>
        </Defs>
        <Rect width="400" height="900" fill={`url(#${id}-base)`} />
        <Path
          d="M335 225C244 193 283 72 234 12C332 35 362 146 335 225ZM335 225C313 126 393 77 447 63C432 175 395 212 335 225ZM335 225C284 172 232 164 195 172C245 224 280 240 335 225ZM335 225C376 166 428 176 454 198C406 247 370 249 335 225Z"
          fill={`url(#${id})`}
        />
        <Path
          d="M32 727C98 668 118 589 102 544C34 587 9 675 32 727ZM32 727C97 719 149 765 166 813C86 803 53 775 32 727ZM32 727C-34 668-34 607-12 571C25 619 46 683 32 727ZM32 727C-14 761-20 816 0 853C51 813 63 769 32 727Z"
          fill={`url(#${id})`}
        />
      </Svg>
    </View>
  );
}
