import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { spacing, typography } from '../../theme/index.ts';

type Props = { label: string; busy?: boolean; onPress: () => void };

export default function BrandButton({ label, busy = false, onPress }: Props) {
  return (
    <Pressable
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      style={({ pressed }) => [styles.button, { opacity: pressed || busy ? 0.7 : 1 }]}
    >
      <View style={styles.background} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="brand-button" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#9846F2" />
              <Stop offset="0.45" stopColor="#6D30D8" />
              <Stop offset="1" stopColor="#4520A4" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#brand-button)" />
        </Svg>
      </View>
      <Text style={styles.label}>{label}</Text>
      {!busy ? <ArrowRight size={23} color="#FFFFFF" accessible={false} /> : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#B376F4',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  background: { ...StyleSheet.absoluteFill },
  label: { ...typography.heading, color: '#FFFFFF', textAlign: 'center', flexShrink: 1 },
});
