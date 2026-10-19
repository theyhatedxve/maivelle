import { Pressable, ScrollView, View } from 'react-native';
import AppText from '../../../components/ui/AppText';
import AppButton from '../../../components/ui/AppButton';
import { taskStyles as styles } from './taskStyles';

/** @param {{label: string, selected: boolean, onPress: () => void, disabled?: boolean}} props */
export function TaskChip({ label, selected, onPress, disabled }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, selected && styles.selected]}><AppText variant="label" tone={selected ? 'primary' : 'muted'}>{label}</AppText></Pressable>;
}
/** @param {{children: import('react').ReactNode}} props */
export function TaskChipRow({ children }) { return <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{children}</ScrollView>; }
/** @param {{categories: import('../../../database/repositories/tasksRepository.js').TaskCategory[], value: string | null | undefined, onChange: (id: string | null | undefined) => void, filter?: boolean, disabled?: boolean}} props */
export function TaskCategories({ categories, value, onChange, filter = false, disabled }) {
  return <TaskChipRow>{filter && <TaskChip label="All categories" selected={value === undefined} onPress={() => onChange(undefined)} disabled={disabled} />}<TaskChip label="Uncategorized" selected={value === null} onPress={() => onChange(null)} disabled={disabled} />{categories.map((category) => <TaskChip key={category.id} label={category.name} selected={value === category.id} onPress={() => onChange(category.id)} disabled={disabled} />)}</TaskChipRow>;
}
export function TaskStorageNotice() { return <View style={styles.notice}><AppText variant="caption" tone="muted">Development storage is not encrypted. Use nonsensitive test tasks only.</AppText></View>; }
/** @param {{message: string, onRetry?: () => void}} props */
export function TaskError({ message, onRetry }) { return <View style={styles.error} accessibilityLiveRegion="polite"><AppText>{message}</AppText>{onRetry && <AppButton label="Try again" variant="secondary" onPress={onRetry} />}</View>; }
