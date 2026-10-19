import { useState } from 'react';
import { ActivityIndicator, FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CalendarDays, Plus } from 'lucide-react-native';
import AppHeader from '../../../components/layout/AppHeader';
import AppButton from '../../../components/ui/AppButton';
import AppText from '../../../components/ui/AppText';
import EmptyState from '../../../components/ui/EmptyState';
import { colors, spacing } from '../../../theme';
import { addDays, addMonths, agendaEntries, localToday, validateDate, visibleRange } from '../services/calendarDates';
import { useCalendarRange, calendarError } from '../hooks/useCalendar';
import CalendarBoard from './CalendarBoard';
import CalendarEntryCard from './CalendarEntryCard';
import { CalendarChip, CalendarChoices, CalendarError, CalendarStorageNotice } from './CalendarControls';
import { calendarStyles as styles } from './calendarStyles';

export default function CalendarScreen() {
  const [selected, setSelected] = useState(localToday()); const [mode, setMode] = useState(/** @type {'month' | 'week' | 'day'} */ ('month'));
  const [search, setSearch] = useState(''); const [navigationError, setNavigationError] = useState('');
  const range = visibleRange(mode,selected); const query = useCalendarRange(range.start,range.end,search);
  const agenda = agendaEntries(query.entries,mode,selected);
  function navigate(/** @type {number} */ direction) {
    try { const day = mode === 'month' ? addMonths(selected,direction) : addDays(selected,direction*(mode === 'week' ? 7 : 1)); validateDate(day); setSelected(day); setNavigationError(''); }
    catch (failure) { setNavigationError(calendarError(failure)); }
  }
  return <SafeAreaView style={styles.safe} edges={['top','left','right']}>
    <FlatList data={agenda} keyExtractor={(entry) => entry.instanceId} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={10} onRefresh={query.refresh} refreshing={false} ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      renderItem={({ item }) => <CalendarEntryCard entry={item} categories={query.categories} />}
      ListHeaderComponent={<View style={styles.section}><AppHeader title="Calendar" subtitle="Events and task deadlines, on this device" /><CalendarStorageNotice />
        <CalendarChoices>{(['month','week','day']).map((value) => <CalendarChip key={value} label={value[0].toUpperCase()+value.slice(1)} selected={mode === value} onPress={() => setMode(/** @type {'month' | 'week' | 'day'} */ (value))} />)}</CalendarChoices>
        <View style={styles.row}><AppButton label="Previous" variant="secondary" onPress={() => navigate(-1)} /><AppButton label="Today" variant="secondary" onPress={() => setSelected(localToday())} /><AppButton label="Next" variant="secondary" onPress={() => navigate(1)} /></View>
        <AppText variant="heading">{range.label}</AppText>
        <TextInput accessibilityLabel="Search calendar" value={search} onChangeText={setSearch} maxLength={1000} style={styles.input} placeholder="Search events, locations and tasks" placeholderTextColor={colors.muted} />
        {mode !== 'day' && <CalendarBoard days={range.days} selected={selected} entries={query.entries} categories={query.categories} onSelect={(day) => { try { validateDate(day); setSelected(day); if (mode === 'week') setMode('day'); setNavigationError(''); } catch (failure) { setNavigationError(calendarError(failure)); } }} />}
        <AppText variant="heading">{mode === 'week' ? `Week agenda · ${range.start} to ${addDays(range.end,-1)}` : `Agenda · ${selected}`}</AppText><AppText variant="caption" tone="muted">Colored dots: events · Checkbox: task deadline</AppText>
        <AppButton label="Manage event series" variant="secondary" onPress={() => router.push('/event/series')} />
        {(query.error || navigationError) && <CalendarError message={query.error || navigationError} onRetry={query.refresh} />}
      </View>}
      ListEmptyComponent={query.loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading calendar" /> : !query.error ? <EmptyState icon={CalendarDays} title="A little space in your day" description={mode === 'week' ? 'No matching events or task deadlines this week.' : 'No matching events or task deadlines on this date.'} /> : undefined} />
    <View style={styles.fab}><AppButton label="Create event" icon={Plus} onPress={() => router.push({ pathname: '/event/new', params: { date: selected } })} /></View>
  </SafeAreaView>;
}
