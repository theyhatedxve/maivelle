import { addDays,localToday } from '../../features/calendar/services/calendarDates.js';
/** @typedef {{granted:boolean,exact:boolean}} ReminderPermissions */
export const MEDICINE_OWNER='maivelle-medicine-v1';
export const REMINDER_WINDOW_DAYS=7;
export const MAX_REMINDERS=100;

/** Crash recovery compares Expo's persisted native requests with SQLite.
 * Startup/foreground rearming also repairs alarms cleared by Android itself.
 * Only notifications with this feature's owner marker are ever cancelled.
 * @param {ReturnType<typeof import('../../database/repositories/medicineRepository.js').createMedicineRepository>} repository
 * @param {{permissions:()=>Promise<ReminderPermissions>,pending:()=>Promise<{id:string,owner:unknown,occurrenceId:unknown,scheduledAt:unknown,delivery:unknown}[]>,cancel:(id:string)=>Promise<void>,schedule:(dose:import('../../features/medicine/services/doseOccurrences.js').Dose,id:string,delivery:'alarmClock'|'bestEffort')=>Promise<string>}} adapter
 */
export function createMedicineReconciler(repository,adapter) {
  let queue=Promise.resolve();
  /** @param {import('../../features/medicine/services/doseOccurrences.js').Dose[]} doses @param {Date} now @param {{rearm?:boolean}} [options] */
  function reconcile(doses,now,options={}) {
    const task=queue.then(async()=>{
      const permissions=await adapter.permissions(); const delivery=permissions.exact?'alarmClock':'bestEffort';
      const end=addDays(localToday(now),REMINDER_WINDOW_DAYS);
      const candidates=doses.filter((dose)=>dose.local.slice(0,10)<end&&!['taken','skipped'].includes(dose.status)&&new Date(dose.scheduledAt)>now).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.id.localeCompare(b.id));
      const desired=new Map((permissions.granted?candidates.slice(0,MAX_REMINDERS):[]).map((dose)=>[dose.id,dose]));
      const pending=(await adapter.pending()).filter((item)=>item.owner===MEDICINE_OWNER);
      const jobs=await repository.jobs(); const ledger=new Map(jobs.map((job)=>[job.occurrence_id,job])); const existing=new Map();
      for(const item of pending) {
        const dose=typeof item.occurrenceId==='string'?desired.get(item.occurrenceId):undefined;
        const nativeId=dose?`maivelle-medicine:${dose.id}`:'';
        if(!dose || item.id!==nativeId || item.scheduledAt!==dose.scheduledAt || item.delivery!==delivery || existing.has(dose.id)) await adapter.cancel(item.id);
        else existing.set(dose.id,item.id);
      }
      for(const job of jobs) if(!desired.has(job.occurrence_id)) await repository.removeJob(job.occurrence_id);
      for(const dose of desired.values()) {
        // Android may remove alarms after force-stop while Expo retains its
        // serialized requests. Explicit foreground/startup rearming replaces the
        // same PendingIntent identity; the request store alone cannot prove it is armed.
        const id=existing.has(dose.id)&&!options.rearm?existing.get(dose.id):await adapter.schedule(dose,`maivelle-medicine:${dose.id}`,delivery);
        const job=ledger.get(dose.id);
        if(!job || job.notification_id!==id || job.scheduled_at!==dose.scheduledAt || job.delivery!==delivery) await repository.putJob(dose,id,delivery);
      }
      return { ...permissions,pending:desired.size,limited:candidates.length>MAX_REMINDERS,horizon:REMINDER_WINDOW_DAYS };
    });
    queue=task.then(()=>{},()=>{}); return task;
  }
  return {reconcile};
}
