import { useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CalendarDays, Plus } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import EmptyState from '../../../components/ui/EmptyState.tsx';
import PlanBackdrop from './PlanBackdrop.tsx';
import { spacing } from '../../../theme/index.ts';
import {
  addDays,
  addMonths,
  agendaEntries,
  localToday,
  validateDate,
  visibleRange,
} from '../services/calendarDates.ts';
import { planDateLabel } from '../services/planPresentation.ts';
import { useCalendarRange, calendarError } from '../hooks/useCalendar.ts';
import CalendarBoard from './CalendarBoard.tsx';
import { CalendarChip, CalendarError } from './CalendarControls.tsx';
import PlanHeader from './PlanHeader.tsx';
import PlanPrivacyBanner from './PlanPrivacyBanner.tsx';
import PlanSummary from './PlanSummary.tsx';
import PlanQuickAdd from './PlanQuickAdd.tsx';
import PlanEntryCard from './PlanEntryCard.tsx';
import { PlanDateNavigation, PlanFilters, PlanSearch, PlanViewSwitch } from './PlanControls.tsx';
import type { PlanMode, PlanFilter } from './PlanControls.tsx';
import { usePlanStyles } from './planStyles.ts';
import PlanGradient from './PlanGradient.tsx';
import { useCalendarNotifications } from '../../../services/notifications/CalendarNotificationsProvider.tsx';

export default function CalendarScreen() {
  const styles = usePlanStyles();
  const { colors } = useTheme();
  const reminders = useCalendarNotifications();
  const [selected, setSelected] = useState(() => localToday());
  const [mode, setMode] = useState<PlanMode>('month');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PlanFilter>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [navigationError, setNavigationError] = useState('');
  const range = visibleRange(mode, selected);
  const query = useCalendarRange(range.start, range.end, search);
  const entries = query.entries.filter(
    (entry) =>
      (filter === 'all' || entry.type === filter) &&
      (!categoryId || (entry.type === 'event' && entry.categoryId === categoryId)) &&
      (showCompleted || entry.type !== 'task' || entry.status !== 'completed'),
  );
  const agenda = agendaEntries(entries, mode, selected);
  const label =
    mode === 'month'
      ? range.label
      : mode === 'day'
        ? planDateLabel(selected)
        : `${planDateLabel(range.start, { month: 'short', day: 'numeric' })} – ${planDateLabel(addDays(range.end, -1), { month: 'short', day: 'numeric' })}`;
  function chooseDay(day: string) {
    try {
      validateDate(day);
      setSelected(day);
      if (mode === 'week') setMode('day');
      setNavigationError('');
    } catch (failure) {
      setNavigationError(calendarError(failure));
    }
  }
  function navigate(direction: number) {
    try {
      const day =
        mode === 'month'
          ? addMonths(selected, direction)
          : addDays(selected, direction * (mode === 'week' ? 7 : 1));
      validateDate(day);
      setSelected(day);
      setNavigationError('');
    } catch (failure) {
      setNavigationError(calendarError(failure));
    }
  }
  function createEvent() {
    Keyboard.dismiss();
    router.push({ pathname: '/event/new', params: { date: selected } });
  }
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <PlanBackdrop />
      <FlatList
        data={agenda}
        keyExtractor={(entry) => entry.instanceId}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        onRefresh={query.refresh}
        refreshing={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => (
          <PlanEntryCard entry={item} categories={query.categories} showDate={mode === 'week'} />
        )}
        ListHeaderComponent={
          <View style={styles.section}>
            <PlanHeader
              back={mode === 'day'}
              onBack={() => setMode('month')}
              subtitle={
                mode === 'day'
                  ? 'Stay organized and get things done.'
                  : 'Your schedule and tasks in one place.'
              }
            />
            {mode === 'month' ? <PlanPrivacyBanner /> : null}
            <PlanViewSwitch mode={mode} onChange={setMode} />
            <PlanDateNavigation
              label={label}
              mode={mode}
              onNavigate={navigate}
              onToday={() => {
                setSelected(localToday());
                setNavigationError('');
              }}
            />
            {mode !== 'month' && !query.loading && !query.error ? (
              <PlanSummary
                entries={agenda}
                from={mode === 'week' ? range.start : selected}
                to={mode === 'week' ? range.end : addDays(selected, 1)}
              />
            ) : null}
            <PlanSearch
              search={search}
              onSearch={setSearch}
              expanded={filtersOpen}
              onToggle={() => setFiltersOpen((value) => !value)}
            />
            {mode !== 'month' || filtersOpen || filter !== 'all' ? (
              <PlanFilters
                filter={filter}
                categoryId={categoryId}
                categories={query.categories}
                onSelect={(kind, category) => {
                  setFilter(kind);
                  setCategoryId(category);
                }}
              />
            ) : null}
            {filtersOpen ? (
              <View style={styles.section}>
                <View style={styles.chipRow}>
                  <CalendarChip
                    label="Include completed tasks"
                    selected={showCompleted}
                    onPress={() => setShowCompleted((value) => !value)}
                  />
                  <CalendarChip
                    label="Clear filters"
                    selected={false}
                    onPress={() => {
                      setFilter('all');
                      setCategoryId(null);
                      setSearch('');
                      setShowCompleted(true);
                    }}
                  />
                </View>
                <AppButton
                  label="Manage event series"
                  variant="secondary"
                  onPress={() => router.push('/event/series')}
                />
              </View>
            ) : null}
            {mode !== 'day' ? (
              <CalendarBoard
                days={range.days}
                selected={selected}
                entries={entries}
                categories={query.categories}
                onSelect={chooseDay}
              />
            ) : null}
            <View style={styles.agendaHeading}>
              <AppText variant="heading" style={styles.flex}>
                {mode === 'week'
                  ? 'Week agenda'
                  : `Agenda · ${planDateLabel(selected, { month: 'short', day: 'numeric' })}`}
              </AppText>
              {mode !== 'day' ? (
                <Pressable
                  style={styles.iconButton}
                  accessibilityRole="button"
                  accessibilityLabel="View selected day agenda"
                  onPress={() => setMode('day')}
                >
                  <AppText variant="caption" tone="primary">
                    View all
                  </AppText>
                </Pressable>
              ) : null}
            </View>
            {query.error || navigationError ? (
              <CalendarError message={query.error || navigationError} onRetry={query.refresh} />
            ) : null}
            {reminders.error ? (
              <CalendarError
                message={reminders.error}
                onRetry={() => {
                  void reminders.refresh();
                }}
              />
            ) : null}
            {reminders.status && !reminders.status.granted ? (
              <AppButton
                label="Allow calendar notifications"
                variant="secondary"
                onPress={() => {
                  void reminders.request();
                }}
              />
            ) : null}
            {reminders.status?.limited ? (
              <AppText variant="caption" tone="muted">
                Only the next 64 reminders within 30 days are scheduled. Open Maivelle regularly to
                refresh them.
              </AppText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.loading ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading Plan" />
          ) : !query.error ? (
            <EmptyState
              icon={CalendarDays}
              title="A little space in your day"
              description={
                mode === 'week'
                  ? 'No matching events or task deadlines this week.'
                  : 'No matching events or task deadlines on this date.'
              }
            />
          ) : undefined
        }
        ListFooterComponent={
          <View style={styles.section}>
            <PlanQuickAdd date={selected} />
            <AppText variant="caption" tone="muted">
              Focus time comes from your Time Tracker. Calendar reminders use private notifications
              and may be delayed by Android. Development storage is unencrypted—use fictional
              sensitive information.
            </AppText>
          </View>
        }
      />
      <View style={styles.fab}>
        <Pressable
          style={styles.fabButton}
          accessibilityRole="button"
          accessibilityLabel="Create event"
          onPress={createEvent}
        >
          <PlanGradient />
          <Plus color={colors.onPrimary} size={31} accessible={false} />
        </Pressable>
        <AppText variant="caption" tone="primary" style={styles.fabCaption}>
          Create event
        </AppText>
      </View>
    </SafeAreaView>
  );
}
