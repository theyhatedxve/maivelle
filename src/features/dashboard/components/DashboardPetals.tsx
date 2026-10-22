import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export default function DashboardPetals() {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="330" viewBox="0 0 400 330" preserveAspectRatio="xMaxYMin slice">
        <Defs>
          <LinearGradient id="dashboard-petal" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#CDB4F7" stopOpacity="0" />
            <Stop offset="1" stopColor="#B895F0" stopOpacity="0.35" />
          </LinearGradient>
        </Defs>
        <Path
          d="M330 205 C248 168 257 75 231 10 C302 35 340 112 330 205Z"
          fill="url(#dashboard-petal)"
        />
        <Path
          d="M330 205 C317 121 365 70 420 53 C416 148 383 185 330 205Z"
          fill="url(#dashboard-petal)"
        />
        <Path
          d="M330 205 C289 154 246 139 211 147 C232 198 287 220 330 205Z M330 205 C366 160 411 161 440 177 C407 227 365 233 330 205Z"
          fill="url(#dashboard-petal)"
        />
      </Svg>
    </View>
  );
}
