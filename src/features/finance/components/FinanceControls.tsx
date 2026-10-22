import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useFinanceStyles } from './financeStyles.ts';

export type FinanceFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  multiline?: boolean;
  money?: boolean;
  signed?: boolean;
};

export type FinanceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export type FinanceErrorProps = {
  message: string;
  onRetry?: () => void;
};

export type AccountPickerProps = {
  accounts: import('../../../database/repositories/financeRepository.ts').FinancialAccount[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  filter?: boolean;
  retainedIds?: string[];
  disabled?: boolean;
};

export type CategoryPickerProps = {
  categories: import('../../../database/repositories/financeRepository.ts').FinancialCategory[];
  value: string | null;
  onChange: (value: string | null) => void;
  kind: string;
  filter?: boolean;
  disabled?: boolean;
};

export function FinanceField({
  label,
  value,
  onChange,
  disabled = false,
  multiline = false,
  money = false,
  signed = false,
}: FinanceFieldProps) {
  const styles = useFinanceStyles();
  return (
    <View style={styles.section}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        multiline={multiline}
        style={styles.input}
        keyboardType={money && !signed ? 'decimal-pad' : 'default'}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

export function FinanceChip({
  label,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
}: FinanceChipProps) {
  const styles = useFinanceStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <AppText tone={selected ? 'primary' : 'text'}>{label}</AppText>
    </Pressable>
  );
}
export function FinanceNotice() {
  const styles = useFinanceStyles();
  return (
    <View style={styles.notice}>
      <AppText variant="caption" tone="muted">
        Development storage is not encrypted. Use fictional accounts and amounts only.
      </AppText>
    </View>
  );
}

export function FinanceError({ message, onRetry }: FinanceErrorProps) {
  const styles = useFinanceStyles();
  return message ? (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <AppText>{message}</AppText>
      {onRetry && <AppButton label="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  ) : null;
}
export function FinanceLoading() {
  const { colors } = useTheme();
  return <ActivityIndicator color={colors.primary} accessibilityLabel="Loading Finance" />;
}

export function AccountPicker({
  accounts,
  value,
  onChange,
  label = 'Account',
  filter = false,
  retainedIds = [],
  disabled = false,
}: AccountPickerProps) {
  const styles = useFinanceStyles();
  const choices = accounts.filter((a) => filter || !a.archived || retainedIds.includes(a.id));
  return (
    <View style={styles.section}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.row}>
        {filter && (
          <FinanceChip
            label="All accounts"
            selected={!value}
            disabled={disabled}
            onPress={() => onChange('')}
          />
        )}
        {choices.map((a) => (
          <FinanceChip
            key={a.id}
            label={`${a.name} (${a.currency})${a.archived ? ' · archived' : ''}`}
            accessibilityLabel={`${label}: ${a.name} (${a.currency})${a.archived ? ' · archived' : ''}`}
            selected={value === a.id}
            disabled={disabled}
            onPress={() => onChange(a.id)}
          />
        ))}
      </View>
      {!choices.length && (
        <AppText tone="muted">Create or restore an account in Accounts first.</AppText>
      )}
    </View>
  );
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  kind,
  filter = false,
  disabled = false,
}: CategoryPickerProps) {
  const styles = useFinanceStyles();
  return (
    <View style={styles.section}>
      <AppText variant="label">Category</AppText>
      <View style={styles.row}>
        <FinanceChip
          label={filter ? 'All categories' : 'Uncategorized'}
          selected={!value}
          disabled={disabled}
          onPress={() => onChange(null)}
        />
        {categories
          .filter((c) => kind === 'all' || c.kind === kind)
          .map((c) => (
            <FinanceChip
              key={c.id}
              label={`${c.name} · ${c.kind}`}
              selected={value === c.id}
              disabled={disabled}
              onPress={() => onChange(c.id)}
            />
          ))}
      </View>
    </View>
  );
}
