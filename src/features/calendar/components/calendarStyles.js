import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../../theme';
export const calendarStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg, paddingBottom: 112 },
  section: { gap: spacing.md }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  input: { ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.sm, minHeight: 52, padding: spacing.lg },
  body: { minHeight: 120, textAlignVertical: 'top' },
  chip: { minHeight: 44, padding: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selected: { backgroundColor: colors.lavender, borderColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.285714%', minHeight: 58, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.xs },
  weekday: { width: '14.285714%', textAlign: 'center', paddingVertical: spacing.sm },
  dots: { flexDirection: 'row', gap: 3, minHeight: 12, alignItems: 'center' }, dot: { width: 6, height: 6, borderRadius: 3 },
  notice: { borderRadius: radii.sm, backgroundColor: colors.lavenderSoft, padding: spacing.md, gap: spacing.sm },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, elevation: 5, borderRadius: radii.pill },
});
