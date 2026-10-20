import { useRef,useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Pill } from 'lucide-react-native';
import AppCard from '../../../components/ui/AppCard';
import AppText from '../../../components/ui/AppText';
import AppButton from '../../../components/ui/AppButton';
import { useDatabase } from '../../../database/DatabaseProvider';
import { medicineError } from '../hooks/useMedicine';
import { MedicineError } from './MedicineControls';
import { medicineStyles as styles } from './medicineStyles';

/** @param {{dose:import('../services/doseOccurrences.js').Dose,readOnly?:boolean}} props */
export default function DoseCard({dose,readOnly=false}) {
  const {medicineService}=useDatabase();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
  async function record(/** @type {'taken'|'skipped'} */ status) {if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await medicineService.record(dose.id,status);}catch(failure){setError(medicineError(failure));}finally{lock.current=false;setBusy(false);}}
  const final=['taken','skipped'].includes(dose.status);
  return <AppCard><View style={styles.section}><AppButton icon={Pill} variant="secondary" label={dose.name} onPress={()=>router.push({pathname:'/medicine/[id]',params:{id:dose.medicineId}})}/>
    <AppText>{dose.local.replace('T',' · ')} · {dose.status.toUpperCase()}</AppText>
    {dose.instructions?<AppText tone="muted">{dose.instructions}</AppText>:null}
    {dose.actionAt&&<AppText variant="caption">Action recorded: {new Date(dose.actionAt).toLocaleString()}</AppText>}
    {!readOnly&&!final&&<View style={styles.row}><AppButton label={busy?'Recording…':'Taken'} disabled={busy||new Date(dose.scheduledAt)>new Date()} onPress={()=>{void record('taken');}}/><AppButton label="Skipped" variant="secondary" disabled={busy||new Date(dose.scheduledAt)>new Date()} onPress={()=>{void record('skipped');}}/></View>}
    {error?<MedicineError message={error}/>:null}
  </View></AppCard>;
}
