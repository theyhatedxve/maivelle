import { useThemedStyles } from '../../../theme/ThemeProvider.tsx';
import { StyleSheet, TextInput, View } from 'react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { radii, spacing } from '../../../theme/index.ts';
import { useVault } from '../providers/VaultProvider.tsx';

export type VaultFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
};

export default function VaultField({
  label,
  value,
  onChange,
  secret = false,
  multiline = false,
  maxLength = 1024,
  editable = true,
}: VaultFieldProps) {
  const styles = useThemedStyles(makeStyles);
  const { service } = useVault();
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={(next) => {
          service.touch();
          onChange(next);
        }}
        secureTextEntry={secret}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="noExcludeDescendants"
        contextMenuHidden={secret}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

const makeStyles = (colors: typeof import('../../../theme/colors').colors) =>
  StyleSheet.create({
    field: { gap: spacing.sm, marginVertical: spacing.sm },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.lavender,
      borderWidth: 1,
      borderRadius: radii.sm,
      padding: spacing.md,
      color: colors.text,
      minHeight: 48,
    },
    multiline: { minHeight: 120, textAlignVertical: 'top' },
  });
