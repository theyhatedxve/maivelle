import { Pressable, ScrollView, View } from 'react-native';
import AppText from '../../../components/ui/AppText';
import AppButton from '../../../components/ui/AppButton';
import { calendarStyles as styles } from './calendarStyles';

/** @param {{label: string, selected: boolean, onPress: () => void, disabled?: boolean, color?: string}} props */
export function CalendarChip({ label, selected, onPress, disabled, color }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} onPress={onPress} disabled={disabled} style={[styles.chip, selected && styles.selected, color ? { borderColor: color } : undefined]}><AppText variant="label" tone={selected ? 'primary' : 'muted'}>{label}</AppText></Pressable>; }
/** @param {{children: import('react').ReactNode}} props */
export function CalendarChoices({ children }) { return <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>{children}</ScrollView>; }
/** @param {{message: string, onRetry?: () => void}} props */
export function CalendarError({ message, onRetry }) { return <View style={styles.notice} accessibilityLiveRegion="polite"><AppText>{message}</AppText>{onRetry && <AppButton label="Try again" variant="secondary" onPress={onRetry} />}</View>; }
export function CalendarStorageNotice() { return <View style={styles.notice}><AppText variant="caption" tone="muted">Unencrypted development storage. Nonsensitive test events only. All times use the device’s local clock.</AppText></View>; }
