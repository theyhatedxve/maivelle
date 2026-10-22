import { useThemedStyles } from '../../../theme/ThemeProvider.tsx';
import { StyleSheet } from 'react-native';
import { radii, spacing, typography } from '../../../theme/index.ts';

const makeStyles = (colors: typeof import('../../../theme/colors').colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      width: '100%',
      maxWidth: 960,
      alignSelf: 'center',
      padding: spacing.xl,
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    section: { gap: spacing.md, marginBottom: spacing.xl },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      alignItems: 'center',
    },
    input: {
      ...typography.body,
      color: colors.text,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.sm,
      padding: spacing.lg,
      minHeight: 52,
    },
    chip: {
      padding: spacing.md,
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
    },
    selected: { borderColor: colors.primary, backgroundColor: colors.lavender },
    notice: {
      padding: spacing.md,
      backgroundColor: colors.lavenderSoft,
      borderRadius: radii.sm,
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    clock: {
      ...typography.display,
      color: colors.primary,
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
    },
    color: { width: 16, height: 16, borderRadius: 8 },
    flex: { flex: 1 },
  });
export const useTimeStyles = () => useThemedStyles(makeStyles);
