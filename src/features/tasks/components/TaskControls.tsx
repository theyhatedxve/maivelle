import { Pressable, ScrollView, View } from 'react-native';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useTaskStyles } from './taskStyles.ts';

export type TaskChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export type TaskChipRowProps = {
  children: import('react').ReactNode;
};

export type TaskCategoriesProps = {
  categories: import('../../../database/repositories/tasksRepository.ts').TaskCategory[];
  value: string | null | undefined;
  onChange: (id: string | null | undefined) => void;
  filter?: boolean;
  disabled?: boolean;
};

export type TaskErrorProps = {
  message: string;
  onRetry?: () => void;
};

export function TaskChip({ label, selected, onPress, disabled }: TaskChipProps) {
  const styles = useTaskStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <AppText variant="label" tone={selected ? 'primary' : 'muted'}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function TaskChipRow({ children }: TaskChipRowProps) {
  const styles = useTaskStyles();
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontal}
    >
      {children}
    </ScrollView>
  );
}

export function TaskCategories({
  categories,
  value,
  onChange,
  filter = false,
  disabled,
}: TaskCategoriesProps) {
  return (
    <TaskChipRow>
      {filter && (
        <TaskChip
          label="All categories"
          selected={value === undefined}
          onPress={() => onChange(undefined)}
          disabled={disabled}
        />
      )}
      <TaskChip
        label="Uncategorized"
        selected={value === null}
        onPress={() => onChange(null)}
        disabled={disabled}
      />
      {categories.map((category) => (
        <TaskChip
          key={category.id}
          label={category.name}
          selected={value === category.id}
          onPress={() => onChange(category.id)}
          disabled={disabled}
        />
      ))}
    </TaskChipRow>
  );
}
export function TaskStorageNotice() {
  const styles = useTaskStyles();
  return (
    <View style={styles.notice}>
      <AppText variant="caption" tone="muted">
        Development storage is not encrypted. Use nonsensitive test tasks only.
      </AppText>
    </View>
  );
}

export function TaskError({ message, onRetry }: TaskErrorProps) {
  const styles = useTaskStyles();
  return (
    <View style={styles.error} accessibilityLiveRegion="polite">
      <AppText>{message}</AppText>
      {onRetry && <AppButton label="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  );
}
