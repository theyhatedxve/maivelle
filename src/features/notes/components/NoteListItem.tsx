import { memo } from 'react';
import { View } from 'react-native';
import { Archive, ArchiveRestore, Pin, PinOff, Trash2 } from 'lucide-react-native';
import AppCard from '../../../components/ui/AppCard.tsx';
import AppText from '../../../components/ui/AppText.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import { useNotesStyles } from './notesStyles.ts';

export type NoteListItemProps = {
  note: import('../../../database/types.ts').Note;
  category: string;
  onOpen: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
  busy: boolean;
};

function NoteListItem({
  note,
  category,
  onOpen,
  onPin,
  onArchive,
  onDelete,
  busy,
}: NoteListItemProps) {
  const styles = useNotesStyles();
  return (
    <View style={styles.section}>
      <AppCard onPress={onOpen} accessibilityLabel={`Open note ${note.title}`}>
        <AppText variant="heading" numberOfLines={2}>
          {note.pinned ? 'Pinned · ' : ''}
          {note.title}
        </AppText>
        <AppText tone="muted" numberOfLines={3}>
          {note.body.trim().slice(0, 240).replace(/\s+/g, ' ') || 'No content'}
        </AppText>
        <AppText variant="caption" tone="muted">
          {category} · Modified {new Date(note.updatedAt).toLocaleString()}
        </AppText>
      </AppCard>
      <View style={styles.row}>
        <AppButton
          label={note.pinned ? 'Unpin' : 'Pin'}
          icon={note.pinned ? PinOff : Pin}
          variant="secondary"
          onPress={onPin}
          disabled={busy}
          accessibilityLabel={`${note.pinned ? 'Unpin' : 'Pin'} ${note.title}`}
        />
        <AppButton
          label={note.archived ? 'Restore' : 'Archive'}
          icon={note.archived ? ArchiveRestore : Archive}
          variant="secondary"
          onPress={onArchive}
          disabled={busy}
          accessibilityLabel={`${note.archived ? 'Restore' : 'Archive'} ${note.title}`}
        />
        <AppButton
          label="Delete"
          icon={Trash2}
          variant="secondary"
          onPress={onDelete}
          disabled={busy}
          accessibilityLabel={`Delete ${note.title}`}
        />
      </View>
    </View>
  );
}
export default memo(NoteListItem);
