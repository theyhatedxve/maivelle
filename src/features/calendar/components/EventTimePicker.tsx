import { ScrollView, View, Pressable } from 'react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { usePlanStyles } from './planStyles.ts';

/** Three independent selection columns keep exact-minute precision without a keyboard
or a new native dependency. Apply/Cancel belong to the enclosing field dialog. */
export default function EventTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const styles = usePlanStyles();
  const [hour24, minute] = value.split(':').map(Number);
  const hour = hour24 % 12 || 12;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  function update(nextHour: number, nextMinute: number, nextPeriod: string) {
    onChange(
      `${String((nextHour % 12) + (nextPeriod === 'PM' ? 12 : 0)).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`,
    );
  }
  const columns = [
    {
      label: 'Hour',
      values: Array.from({ length: 12 }, (_, i) => String(i + 1)),
      selected: String(hour),
      choose: (item: string) => update(Number(item), minute, period),
    },
    {
      label: 'Minute',
      values: Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')),
      selected: String(minute).padStart(2, '0'),
      choose: (item: string) => update(hour, Number(item), period),
    },
    {
      label: 'AM or PM',
      values: ['AM', 'PM'],
      selected: period,
      choose: (item: string) => update(hour, minute, item),
    },
  ];
  return (
    <View style={styles.columns}>
      {columns.map((column) => (
        <View key={column.label} style={styles.timePickerColumn}>
          <AppText variant="caption" tone="muted">
            {column.label}
          </AppText>
          <ScrollView
            nestedScrollEnabled
            style={styles.timePickerScroll}
            contentContainerStyle={styles.timePickerItems}
          >
            {column.values.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="radio"
                accessibilityLabel={`${column.label}: ${item}`}
                accessibilityState={{ checked: column.selected === item }}
                onPress={() => column.choose(item)}
                style={[
                  styles.timePickerOption,
                  column.selected === item && styles.selectedSegment,
                ]}
              >
                <AppText tone={column.selected === item ? 'onPrimary' : 'text'}>{item}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}
