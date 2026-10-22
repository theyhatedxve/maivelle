import { ActivityIndicator, View } from 'react-native';
import { Pill } from 'lucide-react-native';
import ScreenContainer from '../../../components/layout/ScreenContainer.tsx';
import AppHeader from '../../../components/layout/AppHeader.tsx';
import AppButton from '../../../components/ui/AppButton.tsx';
import EmptyState from '../../../components/ui/EmptyState.tsx';
import { useMedicineEditor } from '../hooks/useMedicineEditor.ts';
import { MedicineError, MedicineStorageNotice } from './MedicineControls.tsx';
import MedicineFields from './MedicineFields.tsx';
import { useMedicineStyles } from './medicineStyles.ts';

export type MedicineEditorProps = {
  id?: string | null;
};

export default function MedicineEditor({ id = null }: MedicineEditorProps) {
  const styles = useMedicineStyles();
  const editor = useMedicineEditor(id);
  return (
    <ScreenContainer>
      <AppHeader title={id ? 'Edit medicine' : 'Add medicine'} back />
      <View style={styles.section}>
        <MedicineStorageNotice />
        {editor.loading ? (
          <ActivityIndicator />
        ) : editor.notFound ? (
          <EmptyState
            icon={Pill}
            title="Medicine not found"
            description="This medicine is unavailable. Return to the library."
          />
        ) : (
          <>
            {!editor.failed && (
              <>
                <MedicineFields form={editor.form} setForm={editor.setForm} busy={editor.saving} />
                <AppButton
                  label={editor.saving ? 'Saving…' : 'Save medicine'}
                  disabled={editor.saving}
                  onPress={() => {
                    void editor.save();
                  }}
                />
              </>
            )}
            {editor.error ? (
              <MedicineError
                message={editor.error}
                retry={editor.failed ? editor.retry : undefined}
              />
            ) : null}
          </>
        )}
      </View>
    </ScreenContainer>
  );
}
