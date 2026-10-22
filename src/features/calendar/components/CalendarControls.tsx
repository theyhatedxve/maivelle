import { Pressable, ScrollView, View } from 'react-native';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useCalendarStyles } from './calendarStyles.ts';

export type CalendarChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
};

export type CalendarChoicesProps = {
  children: import('react').ReactNode;
};

export type CalendarErrorProps = {
  message: string;
  onRetry?: () => void;
};

export function CalendarChip({ label, selected, onPress, disabled, color }: CalendarChipProps) {
  const styles = useCalendarStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, selected && styles.selected, color ? { borderColor: color } : undefined]}
    >
      <AppText variant="label" tone={selected ? 'primary' : 'muted'}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function CalendarChoices({ children }: CalendarChoicesProps) {
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, alignItems: 'center' }}
    >
      {children}
    </ScrollView>
  );
}

export function CalendarError({ message, onRetry }: CalendarErrorProps) {
  const styles = useCalendarStyles();
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <AppText>{message}</AppText>
      {onRetry && <AppButton label="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  );
}
export function CalendarStorageNotice() {
  const styles = useCalendarStyles();
  return (
    <View style={styles.notice}>
      <AppText variant="caption" tone="muted">
        Unencrypted development storage. Nonsensitive test events only. All times use the device’s
        local clock.
      </AppText>
    </View>
  );
}
