import { ActivityIndicator,View } from 'react-native';
import { Pill } from 'lucide-react-native';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import AppButton from '../../../components/ui/AppButton';
import EmptyState from '../../../components/ui/EmptyState';
import { useMedicineEditor } from '../hooks/useMedicineEditor';
import { MedicineError,MedicineStorageNotice } from './MedicineControls';
import MedicineFields from './MedicineFields';
import { medicineStyles as styles } from './medicineStyles';
/** @param {{id?:string | null}} props */
export default function MedicineEditor({id=null}) {
  const editor=useMedicineEditor(id);
  return <ScreenContainer><AppHeader title={id?'Edit medicine':'Add medicine'} back/><View style={styles.section}><MedicineStorageNotice/>{editor.loading?<ActivityIndicator/>:editor.notFound?<EmptyState icon={Pill} title="Medicine not found" description="This medicine is unavailable. Return to the library."/>:<>{!editor.failed&&<><MedicineFields form={editor.form} setForm={editor.setForm} busy={editor.saving}/><AppButton label={editor.saving?'Saving…':'Save medicine'} disabled={editor.saving} onPress={()=>{void editor.save();}}/></>}{editor.error?<MedicineError message={editor.error} retry={editor.failed?editor.retry:undefined}/>:null}</>}</View></ScreenContainer>;
}
