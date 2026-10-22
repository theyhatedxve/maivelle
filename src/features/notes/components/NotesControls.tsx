import { Pressable, ScrollView, View } from 'react-native';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useNotesStyles } from './notesStyles.ts';

export type NoteChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export type CategoryPickerProps = {
  categories: import('../../../database/repositories/noteCategoriesRepository.ts').Category[];
  value: string | null | undefined;
  onChange: (id: string | null | undefined) => void;
  filter?: boolean;
  disabled?: boolean;
};

export type NotesErrorProps = {
  message: string;
  onRetry?: () => void;
};

export function StorageNotice() {
  const styles = useNotesStyles();
  return (
    <View style={styles.notice}>
      <AppText variant="caption" tone="muted">
        Development storage is not encrypted. Use nonsensitive test notes only.
      </AppText>
    </View>
  );
}

export function NoteChip({ label, selected, onPress, disabled }: NoteChipProps) {
  const styles = useNotesStyles();
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

export function CategoryPicker({
  categories,
  value,
  onChange,
  filter = false,
  disabled,
}: CategoryPickerProps) {
  const styles = useNotesStyles();
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {filter && (
        <NoteChip
          label="All categories"
          selected={value === undefined}
          onPress={() => onChange(undefined)}
          disabled={disabled}
        />
      )}
      <NoteChip
        label="Uncategorized"
        selected={value === null}
        onPress={() => onChange(null)}
        disabled={disabled}
      />
      {categories.map((category) => (
        <NoteChip
          key={category.id}
          label={category.name}
          selected={value === category.id}
          onPress={() => onChange(category.id)}
          disabled={disabled}
        />
      ))}
    </ScrollView>
  );
}

export function NotesError({ message, onRetry }: NotesErrorProps) {
  const styles = useNotesStyles();
  return (
    <View style={styles.error} accessibilityLiveRegion="polite">
      <AppText>{message}</AppText>
      {onRetry && <AppButton label="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  );
}
