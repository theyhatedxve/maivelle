import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../../theme';

export const notesStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: spacing.xl, gap: spacing.lg, paddingBottom: 112 },
  input: { ...typography.body, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: spacing.lg, minHeight: 52 },
  body: { minHeight: 240, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  section: { gap: spacing.md },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selected: { backgroundColor: colors.lavender, borderColor: colors.primary },
  notice: { backgroundColor: colors.lavenderSoft, borderRadius: radii.sm, padding: spacing.md },
  error: { borderWidth: 1, borderColor: colors.primary, borderRadius: radii.sm, padding: spacing.md, gap: spacing.sm },
  fab: { position: 'absolute', bottom: spacing.lg, right: spacing.xl, elevation: 5, borderRadius: radii.pill },
});
