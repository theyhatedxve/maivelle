import { Pressable, TextInput, View } from 'react-native';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react-native';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import { usePlanStyles } from './planStyles.ts';
import type { CalendarCategory } from '../../../database/repositories/calendarRepository.ts';
import PlanGradient from './PlanGradient.tsx';

export type PlanMode = 'month' | 'week' | 'day';
export type PlanFilter = 'all' | 'event' | 'task';
export function PlanViewSwitch({
  mode,
  onChange,
}: {
  mode: PlanMode;
  onChange: (mode: PlanMode) => void;
}) {
  const styles = usePlanStyles();
  return (
    <View style={styles.segmented}>
      {(['month', 'week', 'day'] as const).map((value) => (
        <Pressable
          key={value}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === value }}
          accessibilityLabel={`${value} view`}
          onPress={() => onChange(value)}
          style={[styles.segment, mode === value && styles.selectedSegment]}
        >
          {mode === value ? <PlanGradient /> : null}
          <AppText variant="label" tone={mode === value ? 'onPrimary' : 'muted'}>
            {value[0].toUpperCase() + value.slice(1)}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
export function PlanDateNavigation({
  label,
  mode,
  onNavigate,
  onToday,
}: {
  label: string;
  mode: PlanMode;
  onNavigate: (direction: number) => void;
  onToday: () => void;
}) {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.dateRow}>
      <View style={styles.dateNav}>
        <Pressable
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={`Previous ${mode}`}
          onPress={() => onNavigate(-1)}
        >
          <ChevronLeft size={23} color={colors.primary} accessible={false} />
        </Pressable>
        <AppText variant="label" style={styles.dateLabel}>
          {label}
        </AppText>
        <Pressable
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={`Next ${mode}`}
          onPress={() => onNavigate(1)}
        >
          <ChevronRight size={23} color={colors.primary} accessible={false} />
        </Pressable>
      </View>
      <Pressable style={styles.today} accessibilityRole="button" onPress={onToday}>
        <AppText variant="label" tone="primary">
          Today
        </AppText>
      </Pressable>
    </View>
  );
}
export function PlanSearch({
  search,
  onSearch,
  expanded,
  onToggle,
}: {
  search: string;
  onSearch: (value: string) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.searchRow}>
      <View style={styles.search}>
        <Search size={18} color={colors.muted} accessible={false} />
        <TextInput
          accessibilityLabel="Search events, locations and tasks"
          value={search}
          onChangeText={onSearch}
          maxLength={1000}
          autoCorrect={false}
          placeholder="Search events, locations and tasks…"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>
      <Pressable
        style={styles.filterButton}
        accessibilityRole="button"
        accessibilityLabel="Calendar filters"
        accessibilityState={{ expanded }}
        onPress={onToggle}
      >
        <SlidersHorizontal size={21} color={colors.primary} accessible={false} />
      </Pressable>
    </View>
  );
}
export function PlanFilters({
  filter,
  categoryId,
  categories,
  onSelect,
}: {
  filter: PlanFilter;
  categoryId: string | null;
  categories: CalendarCategory[];
  onSelect: (filter: PlanFilter, categoryId: string | null) => void;
}) {
  const styles = usePlanStyles();
  const options: { label: string; filter: PlanFilter; id: string | null; color?: string }[] = [
    { label: 'All', filter: 'all', id: null },
    { label: 'Events', filter: 'event', id: null },
    { label: 'Tasks', filter: 'task', id: null },
    ...categories.map((category) => ({
      label: category.name,
      filter: 'event' as const,
      id: category.id,
      color: category.color,
    })),
  ];
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const selected = filter === option.filter && categoryId === option.id;
        return (
          <Pressable
            key={`${option.filter}:${option.id}`}
            style={[styles.chip, selected && styles.selectedChip]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(option.filter, option.id)}
          >
            {option.color ? <View style={[styles.dot, { backgroundColor: option.color }]} /> : null}
            <AppText variant="caption" tone={selected ? 'onPrimary' : 'muted'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
