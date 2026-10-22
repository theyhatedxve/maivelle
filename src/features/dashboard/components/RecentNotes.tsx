import { View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, FileText, Pin } from 'lucide-react-native';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import { useTheme } from '../../../theme/ThemeProvider.tsx';
import type { Note } from '../../../database/types.ts';
import { useDashboardStyles } from './dashboardStyles.ts';

type Props = { notes: Note[]; loading: boolean; error: string };
export default function RecentNotes({ notes, loading, error }: Props) {
  const styles = useDashboardStyles();
  const { colors } = useTheme();
  if (error)
    return (
      <AppCard onPress={() => router.push('/notes')}>
        <AppText tone="muted">{error}</AppText>
      </AppCard>
    );
  if (loading) return <AppText tone="muted">Loading recent notes…</AppText>;
  if (!notes.length)
    return (
      <AppCard onPress={() => router.push('/notes/new')}>
        <AppText tone="muted">A fresh page awaits. Add your first note.</AppText>
      </AppCard>
    );
  return (
    <View style={styles.notes}>
      {notes.map((note) => (
        <AppCard
          key={note.id}
          style={styles.noteRow}
          onPress={() => router.push({ pathname: '/notes/[id]', params: { id: note.id } })}
          accessibilityLabel={`Open note ${note.title}${note.pinned ? ', pinned' : ''}`}
        >
          <View style={styles.badge}>
            <FileText color={colors.primary} size={25} accessible={false} />
          </View>
          <View style={styles.rowCopy}>
            <AppText variant="label" numberOfLines={1}>
              {note.title}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={2}>
              {note.body.replace(/\s+/g, ' ').trim() || 'No content yet'}
            </AppText>
            <AppText variant="caption" tone="muted">
              {new Date(note.updatedAt).toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </AppText>
          </View>
          {note.pinned ? <Pin size={16} color={colors.primary} accessible={false} /> : null}
          <ChevronRight size={18} color={colors.muted} accessible={false} />
        </AppCard>
      ))}
    </View>
  );
}
