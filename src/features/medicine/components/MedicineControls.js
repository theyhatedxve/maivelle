import { Pressable,View } from 'react-native';
import AppText from '../../../components/ui/AppText';
import AppButton from '../../../components/ui/AppButton';
import { useMedicineNotifications } from '../../../services/notifications/MedicineNotificationsProvider';
import { medicineStyles as styles } from './medicineStyles';

/** @param {{label:string,selected:boolean,onPress:()=>void,disabled?:boolean}} props */
export function MedicineChip({label,selected,onPress,disabled=false}) {return <Pressable accessibilityRole="button" accessibilityState={{selected,disabled}} onPress={onPress} disabled={disabled} style={[styles.chip,selected&&styles.selected]}><AppText tone={selected?'primary':'muted'}>{label}</AppText></Pressable>;}
export function MedicineStorageNotice() {return <View style={styles.notice}><AppText variant="caption">Development storage is not encrypted. Use fictional test medicines only. Do not enter real medication or health information.</AppText><AppText variant="caption" tone="muted">Enter only instructions supplied to you. Maivelle does not recommend dosages or treatments.</AppText></View>;}
/** @param {{message:string,retry?:()=>void}} props */
export function MedicineError({message,retry}) {return <View style={styles.notice} accessibilityLiveRegion="polite"><AppText>{message}</AppText>{retry&&<AppButton variant="secondary" label="Try again" onPress={retry}/>}</View>;}
export function ReminderPermissions() {
  const {status,error,refresh,request,settings}=useMedicineNotifications();
  return <View style={styles.notice}><AppText variant="heading">Local reminders</AppText>
    <AppText>{status?`Notifications: ${status.granted?'allowed':'blocked'} · Exact alarms: ${status.exact?'allowed':'unavailable'} · ${status.pending} pending`:'Checking reminder capability…'}</AppText>
    {error?<MedicineError message={error} retry={()=>{void refresh();}}/>:null}
    <AppText variant="caption" tone="muted">{!status?.granted?'Reminders are unavailable until notifications and the medication channel are enabled. ':!status.exact?'Approximate delivery: alarms may arrive late. ':''}Android and HONOR battery restrictions can delay or prevent delivery. Exact delivery is never guaranteed. After restarting your phone, open Maivelle to restore reminders. Open Maivelle at least weekly to refill the 7-day queue (up to 100 reminders). Force-stop prevents reminders until the app is reopened.</AppText>
    {status?.limited&&<AppText>Queue limit reached. Open Maivelle daily to refill upcoming reminders.</AppText>}
    <View style={styles.row}>{!status?.granted&&<AppButton label="Enable reminders" onPress={()=>{void request();}}/>}{!status?.exact&&<AppButton variant="secondary" label="Allow exact alarms" onPress={()=>{void request(true);}}/>}<AppButton variant="secondary" label="Android app settings" onPress={settings}/><AppButton variant="secondary" label="Refresh reminders" onPress={()=>{void refresh();}}/></View>
  </View>;
}
