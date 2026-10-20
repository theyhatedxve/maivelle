import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { router } from 'expo-router';
import { useDatabase } from '../../database/DatabaseProvider';
import { addDays,localToday } from '../../features/calendar/services/calendarDates.js';
import { createMedicineReconciler, MEDICINE_OWNER, REMINDER_WINDOW_DAYS } from './medicineReconciler.js';

/** @typedef {{granted:boolean,exact:boolean,pending:number,limited:boolean,horizon:number}} ReminderStatus */
/** @typedef {{status:ReminderStatus | null,error:string,refresh:()=>Promise<void>,request:(exact?:boolean)=>Promise<void>,settings:()=>void}} NotificationContextValue */
const Context=createContext(/** @type {NotificationContextValue | null} */(null));
/** @param {{children:import('react').ReactNode}} props */
export default function MedicineNotificationsProvider({children}) {
  const {medicineService,medicineRepository}=useDatabase();
  const [status,setStatus]=useState(/** @type {ReminderStatus | null} */(null)); const [error,setError]=useState('');
  const infrastructure=useRef(/** @type {Promise<typeof import('./localNotifications.js')> | null} */(null));
  const engine=useRef(/** @type {ReturnType<typeof createMedicineReconciler> | null} */(null));
  const alive=useRef(true); const serial=useRef(Promise.resolve());
  const load=useCallback(()=>infrastructure.current ??= import('./localNotifications.js'),[]);
  const refresh=useCallback((rearm=true)=>{
    const task=serial.current.then(async()=>{
      try {
        const native=await load(); engine.current ??= createMedicineReconciler(medicineRepository,native.localNotificationAdapter);
        const now=new Date(); const today=localToday(now);
        const doses=await medicineService.doses(today,addDays(today,REMINDER_WINDOW_DAYS));
        const result=await engine.current.reconcile(doses,now,{rearm});
        if(alive.current) {setStatus(result);setError('');}
      } catch { if(alive.current) setError('Local reminders could not reconcile. Open Medicine to retry. A native rebuild may be required. Dose records remain available.'); }
    });
    serial.current=task; return task;
  },[load,medicineRepository,medicineService]);
  useEffect(()=>{
    alive.current=true; void refresh();
    const changes=medicineService.subscribe(()=>{void refresh();});
    const foreground=AppState.addEventListener('change',(state)=>{if(state==='active') void refresh();});
    const timer=setInterval(()=>{if(AppState.currentState==='active') void refresh(false);},60000);
    /** @type {{remove:()=>void} | undefined} */ let taps;
    // Import failure is displayed through refresh, rather than breaking database navigation.
    load().then(async()=>{
      const notifications=await import('expo-notifications'); if(!alive.current)return;
      const redirect=(/** @type {import('expo-notifications').NotificationResponse} */ response)=>{
        const data=response.notification.request.content.data;
        if(data?.owner===MEDICINE_OWNER && typeof data.medicineId==='string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(data.medicineId)) {router.push({pathname:'/medicine/[id]',params:{id:data.medicineId}}); notifications.clearLastNotificationResponse();}
      };
      const last=notifications.getLastNotificationResponse(); if(last) redirect(last);
      taps=notifications.addNotificationResponseReceivedListener(redirect);
    }).catch(()=>{ /* refresh exposes the same native capability failure. */ });
    return ()=>{alive.current=false;changes();foreground.remove();clearInterval(timer);taps?.remove();};
  },[load,medicineService,refresh]);
  const request=useCallback(async(exact=false)=>{
    try {const native=await load(); if(exact) await native.requestMedicineExactAlarms(); else await native.requestMedicineNotifications(); await refresh();}
    catch {setError('Could not open reminder permission settings. Check Android App info → Notifications and Alarms & reminders.');}
  },[load,refresh]);
  return <Context.Provider value={{status,error,refresh,request,settings:()=>{Linking.openSettings().catch(()=>setError('Open Android App info for Maivelle manually.'));}}}>{children}</Context.Provider>;
}
export function useMedicineNotifications() {const context=useContext(Context);if(!context)throw new Error('Reminder provider is unavailable.');return context;}
