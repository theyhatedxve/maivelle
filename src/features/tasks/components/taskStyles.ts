import { useThemedStyles } from '../../../theme/ThemeProvider.tsx';
import { StyleSheet } from 'react-native';
import { radii, spacing, typography } from '../../../theme/index.ts';

const makeTaskStyles = (colors: typeof import('../../../theme/colors').colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      width: '100%',
      maxWidth: 960,
      alignSelf: 'center',
      padding: spacing.xl,
      paddingBottom: 112,
      gap: spacing.lg,
    },
    section: { gap: spacing.md },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
    horizontal: { gap: spacing.sm, alignItems: 'center' },
    input: {
      ...typography.body,
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      padding: spacing.lg,
      minHeight: 52,
    },
    body: { minHeight: 140, textAlignVertical: 'top' },
    chip: {
      minHeight: 44,
      padding: spacing.md,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    selected: { borderColor: colors.primary, backgroundColor: colors.lavender },
    notice: { backgroundColor: colors.lavenderSoft, borderRadius: radii.sm, padding: spacing.md },
    error: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radii.sm,
      padding: spacing.md,
      gap: spacing.sm,
    },
    fab: {
      position: 'absolute',
      bottom: spacing.lg,
      right: spacing.xl,
      borderRadius: radii.pill,
      elevation: 5,
    },
    subtask: {
      padding: spacing.md,
      borderRadius: radii.sm,
      backgroundColor: colors.lavenderSoft,
      gap: spacing.sm,
    },
  });
export const useTaskStyles = () => useThemedStyles(makeTaskStyles);
