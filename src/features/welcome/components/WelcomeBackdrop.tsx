import { StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/** Decorative vector ribbons; content is rendered separately as accessible native UI. */
export default function WelcomeBackdrop() {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox="0 0 400 860" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="welcome-base" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#EDE0FF" />
            <Stop offset="0.45" stopColor="#FFFBFF" />
            <Stop offset="1" stopColor="#EDE2FC" />
          </LinearGradient>
          <LinearGradient id="welcome-ribbon" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#C39AF4" stopOpacity="0.6" />
            <Stop offset="0.45" stopColor="#F9EDFF" stopOpacity="0.85" />
            <Stop offset="0.7" stopColor="#D0AFF5" stopOpacity="0.65" />
            <Stop offset="1" stopColor="#FFFAFF" stopOpacity="0.9" />
          </LinearGradient>
          <RadialGradient id="welcome-glow">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="400" height="860" fill="url(#welcome-base)" />
        <Ellipse cx="205" cy="190" rx="205" ry="240" fill="url(#welcome-glow)" />
        <Path
          d="M-80 160 C100 210 15 395 248 482 C65 480 35 320 -80 350Z"
          fill="url(#welcome-ribbon)"
          stroke="#FFFFFF"
          strokeOpacity="0.6"
        />
        <Path
          d="M440 266 C325 325 372 421 240 485 C368 458 444 465 480 541Z"
          fill="url(#welcome-ribbon)"
          stroke="#FFFFFF"
          strokeOpacity="0.7"
        />
        <Path
          d="M244 485 C215 449 173 416 186 374 C225 379 259 445 244 485Z"
          fill="url(#welcome-ribbon)"
          stroke="#FFFFFF"
          strokeOpacity="0.8"
        />
        <Path
          d="M245 485 C245 415 287 390 310 326 C322 411 291 460 245 485Z"
          fill="url(#welcome-ribbon)"
          stroke="#FFFFFF"
          strokeOpacity="0.8"
        />
        <Path
          d="M-90 540 C68 392 149 445 247 485 C347 527 390 397 480 414 L480 681 C315 594 166 476 -90 690Z"
          fill="url(#welcome-ribbon)"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeOpacity="0.8"
        />
        <Path
          d="M-75 677 C71 497 200 455 305 529 C411 601 405 656 469 706 C302 680 149 519 -75 782Z"
          fill="url(#welcome-ribbon)"
          stroke="#FFFFFF"
          strokeOpacity="0.8"
        />
        <Ellipse cx="194" cy="775" rx="280" ry="225" fill="url(#welcome-glow)" />
        <Path
          d="M242 355 Q245 370 255 373 Q245 377 242 391 Q239 377 229 373 Q239 370 242 355Z"
          fill="#B879F1"
          fillOpacity="0.7"
        />
      </Svg>
    </View>
  );
}
