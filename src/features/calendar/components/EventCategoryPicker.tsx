import { useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronDown, Tag } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import type { CalendarCategory } from '../../../database/repositories/calendarRepository.ts';
import { usePlanStyles } from './planStyles.ts';

type Props = {
  categories: CalendarCategory[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
};
export default function EventCategoryPicker({ categories, value, onChange, disabled }: Props) {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const selected = categories.find((category) => category.id === value);
  const options = [{ id: null, name: 'Uncategorized', color: colors.primary }, ...categories];
  return (
    <View style={styles.formGroup}>
      <AppText variant="label">Category</AppText>
      <Pressable
        style={styles.fieldRow}
        accessibilityRole="button"
        accessibilityLabel={`Event category: ${selected?.name ?? 'Uncategorized'}`}
        disabled={disabled}
        onPress={() => setVisible(true)}
        accessibilityState={{ disabled }}
      >
        <View style={styles.fieldIcon}>
          <Tag size={19} color={selected?.color ?? colors.primary} accessible={false} />
        </View>
        <AppText style={styles.dateValue}>{selected?.name ?? 'Uncategorized'}</AppText>
        <ChevronDown size={16} color={colors.muted} accessible={false} />
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <AppText variant="heading">Choose category</AppText>
            <FlatList
              data={options}
              keyExtractor={(item) => item.id ?? 'uncategorized'}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.id === value }}
                  style={styles.fieldRow}
                  onPress={() => {
                    onChange(item.id);
                    setVisible(false);
                  }}
                >
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <AppText style={styles.dateValue}>{item.name}</AppText>
                  {item.id === value ? (
                    <Check size={19} color={colors.primary} accessible={false} />
                  ) : null}
                </Pressable>
              )}
            />
            <AppButton label="Cancel" variant="secondary" onPress={() => setVisible(false)} />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
