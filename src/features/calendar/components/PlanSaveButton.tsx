import { ActivityIndicator, Pressable } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import PlanGradient from './PlanGradient.tsx';
import { usePlanStyles } from './planStyles.ts';

export default function PlanSaveButton({
  busy,
  disabled,
  onPress,
}: {
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.saveButton, { opacity: pressed || disabled ? 0.6 : 1 }]}
    >
      <PlanGradient />
      {busy ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <CalendarDays size={21} color={colors.onPrimary} accessible={false} />
      )}
      <AppText variant="label" tone="onPrimary">
        {busy ? 'Saving…' : 'Save event'}
      </AppText>
    </Pressable>
  );
}
