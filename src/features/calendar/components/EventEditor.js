import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarX, Save } from 'lucide-react-native';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import AppButton from '../../../components/ui/AppButton';
import AppText from '../../../components/ui/AppText';
import EmptyState from '../../../components/ui/EmptyState';
import { colors } from '../../../theme';
import { calendarPalette } from '../../../theme/calendar';
import { useEventEditor } from '../hooks/useEventEditor';
import { calendarError } from '../hooks/useCalendar';
import EventFields from './EventFields';
import { CalendarChoices, CalendarChip, CalendarError, CalendarStorageNotice } from './CalendarControls';
import { calendarStyles as styles } from './calendarStyles';

/** @param {{id: string | null, occurrence: string | null, date: string}} props */
export default function EventEditor({ id, occurrence, date }) {
  const [categoryName,setCategoryName] = useState(''); const [color,setColor] = useState(colors.primary); const [adding,setAdding] = useState(false); const categoryLock = useRef(false);
  const editor = useEventEditor(id,occurrence,date,!!categoryName || adding); const { busy, form, setForm } = editor;
  async function addCategory() {
    if (categoryLock.current) return; categoryLock.current = true; setAdding(true); editor.setError('');
    try { const category = await editor.calendarService.createCategory(categoryName,color); editor.setCategories(await editor.calendarService.listCategories()); setForm((value) => ({ ...value, categoryId: category.id })); setCategoryName(''); Keyboard.dismiss(); }
    catch (failure) { editor.setError(calendarError(failure)); } finally { categoryLock.current = false; setAdding(false); }
  }
  function remove() {
    if (!id) return;
    Alert.alert(occurrence ? 'Cancel this occurrence?' : 'Delete event series?', occurrence ? 'Only this occurrence will be hidden. Restore it from Manage event series.' : 'This deletes the parent event and all its occurrence exceptions.', [{ text: 'Keep event', style: 'cancel' }, { text: occurrence ? 'Cancel occurrence' : 'Delete', style: 'destructive', onPress: () => { void editor.perform(() => occurrence ? editor.calendarService.cancelOccurrence(id,occurrence,true) : editor.calendarService.deleteEvent(id,true),true); } }]);
  }
  return <ScreenContainer><AppHeader title={id ? occurrence ? 'Edit occurrence' : 'Edit event series' : 'Create event'} subtitle={editor.dirty ? 'Unsaved changes' : 'Local calendar'} back />
    {editor.loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading event" /> : editor.loadFailed ? <CalendarError message={editor.error} onRetry={editor.retry} /> : editor.notFound ? <EmptyState icon={CalendarX} title="Event not found" description="The event or recurrence instance no longer exists." action={<AppButton label="Back to Calendar" onPress={() => router.dismissTo('/calendar')} />} /> : <View style={styles.section}>
      <CalendarStorageNotice />{editor.error && <CalendarError message={editor.error} />}
      {occurrence && id && <View style={styles.notice}><AppText variant="label">Occurrence · originally {occurrence.replace('T',' ')}</AppText><AppButton label="Edit entire series" variant="secondary" disabled={busy || adding} onPress={() => router.replace({ pathname: '/event/[id]', params: { id } })} /></View>}
      {editor.cancelled ? <View style={styles.notice}><AppText>This occurrence is cancelled.</AppText><AppButton label="Restore occurrence" disabled={busy || adding} onPress={() => { if (id && occurrence) void editor.perform(() => editor.calendarService.restoreOccurrence(id,occurrence,true),true); }} /></View> : <>
        <EventFields form={form} setForm={setForm} busy={busy || adding} occurrence={!!occurrence} />
        <AppText variant="label">Event category</AppText><CalendarChoices><CalendarChip label="Uncategorized" selected={form.categoryId === null} onPress={() => setForm((value) => ({ ...value, categoryId: null }))} disabled={busy || adding} />{editor.categories.map((category) => <CalendarChip key={category.id} label={category.name} color={category.color} selected={form.categoryId === category.id} onPress={() => setForm((value) => ({ ...value, categoryId: category.id }))} disabled={busy || adding} />)}</CalendarChoices>
        <TextInput accessibilityLabel="Event category name" value={categoryName} onChangeText={setCategoryName} maxLength={80} editable={!busy && !adding} style={styles.input} placeholder="New event category name (optional)" placeholderTextColor={colors.muted} />
        <CalendarChoices>{calendarPalette.map((item) => <CalendarChip key={item.color} label={item.name} color={item.color} selected={color === item.color} onPress={() => setColor(item.color)} disabled={busy || adding} />)}</CalendarChoices>
        <AppButton label={adding ? 'Adding category…' : 'Add event category'} variant="secondary" onPress={() => { void addCategory(); }} disabled={busy || adding || !categoryName.trim()} />
        {!!categoryName && <AppButton label="Clear category draft" variant="secondary" onPress={() => setCategoryName('')} disabled={busy || adding} />}
        <AppButton label={busy ? 'Saving…' : 'Save event'} icon={Save} onPress={() => { Keyboard.dismiss(); void editor.save(); }} disabled={busy || adding || !!categoryName} />
      </>}
      {id && !occurrence && editor.exceptions.length > 0 && <View style={styles.section}><AppText variant="heading">Occurrence exceptions</AppText><AppText tone="muted">Restore exceptions before changing the series schedule or recurrence. Restoration saves immediately.</AppText>{editor.exceptions.map((exception) => <View key={exception.occurrenceStart} style={styles.notice}><AppText>{exception.kind} · {exception.occurrenceStart.replace('T',' ')}</AppText><AppButton label={`Restore ${exception.occurrenceStart.slice(0,10)}`} variant="secondary" disabled={busy || adding} onPress={() => Alert.alert('Restore original occurrence?', 'The saved occurrence edit or cancellation will be removed.', [{ text: 'Keep exception', style: 'cancel' }, { text: 'Restore', onPress: () => { void editor.perform(() => editor.calendarService.restoreOccurrence(id,exception.occurrenceStart,true)); } }])} /></View>)}</View>}
      {id && !editor.cancelled && <AppButton label={occurrence ? 'Cancel this occurrence' : 'Delete event series'} variant="secondary" onPress={remove} disabled={busy || adding} />}
    </View>}
  </ScreenContainer>;
}
