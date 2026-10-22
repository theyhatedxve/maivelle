import { useThemedStyles } from '../../../theme/ThemeProvider.tsx';
import { StyleSheet } from 'react-native';
import { spacing, radii, typography } from '../../../theme/index.ts';

const makeStyles = (colors: typeof import('../../../theme/colors').colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      width: '100%',
      maxWidth: 960,
      alignSelf: 'center',
      padding: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    section: { gap: spacing.md, marginBottom: spacing.xl },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      alignItems: 'center',
    },
    flex: { flex: 1 },
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
    notice: {
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.lavenderSoft,
      borderRadius: radii.sm,
      marginBottom: spacing.md,
    },
    chip: {
      minHeight: 48,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
    },
    selected: { borderColor: colors.primary, backgroundColor: colors.lavender },
    color: { width: 16, height: 16, borderRadius: 8 },
  });
export const useFinanceStyles = () => useThemedStyles(makeStyles);
