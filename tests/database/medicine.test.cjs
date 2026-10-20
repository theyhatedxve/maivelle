const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {mkdtempSync,rmSync}=require('node:fs');
const {join,dirname,resolve,basename}=require('node:path');
const {tmpdir}=require('node:os');
const {spawnSync}=require('node:child_process');
const {openTestDatabase}=require('./sqliteAdapter.cjs');
const {initializeDatabase}=require('../../src/database/initialize.js');
const {migrations}=require('../../src/database/migrations/index.js');
const {applyMigrations}=require('../../src/database/migrations/migrate.js');
const {createMedicineRepository}=require('../../src/database/repositories/medicineRepository.js');
const {createMedicineService}=require('../../src/features/medicine/services/medicineService.js');
const {generateDoses}=require('../../src/features/medicine/services/doseOccurrences.js');
const {validateMedicine}=require('../../src/features/medicine/validation/medicineInput.js');
const {createMedicineReconciler,MEDICINE_OWNER}=require('../../src/services/notifications/medicineReconciler.js');

const schedule=(extra={})=>({weekdays:[0,1,2,3,4,5,6],times:['08:00','20:00'],startDate:null,endDate:null,...extra});
const input=(extra={})=>({name:'Fictional test medicine',form:'Sample form',instructions:'Fictional instruction',notes:'No health data',active:true,startDate:null,endDate:null,schedules:[schedule()],...extra});
async function fixture(t,file) {
  const db=openTestDatabase(file);t.after(()=>db.closeAsync());await initializeDatabase(db);
  let now=new Date(2026,9,20,9,0,0,0);
  const repository=createMedicineRepository(db,randomUUID);const service=createMedicineService(repository,()=>now);
  return {db,repository,service,clock:(next)=>{now=next;}};
}
function fakeNotifications() {
  const pending=new Map();let permissions={granted:true,exact:false};const cancelled=[];
  return {pending,cancelled,setPermissions:(value)=>{permissions=value;},adapter:{
    permissions:async()=>permissions,pending:async()=>[...pending.values()],
    cancel:async(id)=>{cancelled.push(id);pending.delete(id);},
    schedule:async(dose,id,delivery)=>{pending.set(id,{id,owner:MEDICINE_OWNER,occurrenceId:dose.id,scheduledAt:dose.scheduledAt,delivery});return id;},
  }};
}

test('Medicine CRUD binds input, preserves creation timestamp, filters and detects stale saves',async(t)=>{
  const {service,clock}=await fixture(t);const medicine=await service.save(null,input({name:"  Synthetic '); DROP TABLE notes; --  "}));
  assert.equal(medicine.name,"Synthetic '); DROP TABLE notes; --");assert.deepEqual((await service.get(medicine.id)).schedules,[schedule()]);
  clock(new Date(2026,9,20,10));const edited=await service.save(medicine.id,input({name:'Changed'}),medicine.revision);
  assert.equal(edited.createdAt,medicine.createdAt);assert.ok(edited.updatedAt>medicine.updatedAt);assert.equal(edited.revision,2);
  await assert.rejects(service.save(medicine.id,input(),medicine.revision),{code:'CONFLICT'});
  assert.equal((await service.list('changed','active')).length,1);assert.equal((await service.list('missing','all')).length,0);
  assert.equal((await service.list('changed','inactive')).length,0);assert.equal(await service.get('absent'),null);
});

test('daily, selected weekdays, multiple times and schedule/medicine boundaries are inclusive',async(t)=>{
  const {service}=await fixture(t);
  const med=await service.save(null,input({startDate:'2026-10-21',endDate:'2026-10-23',schedules:[schedule({weekdays:[1,3,5],times:['08:00','12:00'],endDate:'2026-10-22'}),schedule({weekdays:[2,4],times:['17:00']})]}));
  const doses=await service.doses('2026-10-20','2026-10-25',med.id);
  assert.deepEqual(doses.map((dose)=>dose.local),['2026-10-21T08:00','2026-10-21T12:00','2026-10-22T17:00']);
  assert.equal(new Set(doses.map((dose)=>dose.id)).size,3);
});

test('Taken and Skipped preserve actual timestamps; stable IDs reject duplicate and future actions',async(t)=>{
  const {service,repository,clock,db}=await fixture(t);await service.save(null,input());let doses=await service.doses('2026-10-20','2026-10-21');
  assert.equal(doses[0].status,'missed');assert.equal(doses[1].status,'pending');
  await service.record(doses[0].id,'taken');await assert.rejects(service.record(doses[0].id,'skipped'),{code:'CONFLICT'});
  await assert.rejects(service.record(doses[1].id,'taken'),{code:'VALIDATION'});
  clock(new Date(2026,9,20,20,10));await service.record(doses[1].id,'skipped');
  doses=await service.doses('2026-10-20','2026-10-21');assert.deepEqual(doses.map((dose)=>dose.status),['taken','skipped']);
  const logs=await repository.logs('2026-10-20','2026-10-21');assert.notEqual(logs[0].action_at,logs[0].scheduled_at);assert.ok(logs[0].timezone);
  assert.equal((await service.summary()).taken,1);assert.equal((await service.summary()).skipped,1);
  await assert.rejects(db.runAsync('INSERT INTO medicine_dose_logs SELECT * FROM medicine_dose_logs LIMIT 1'),/UNIQUE/);
});

test('missed is derived at the 60-minute boundary and never persisted by reminders',async(t)=>{
  const {service,clock,repository}=await fixture(t);await service.save(null,input());
  clock(new Date(2026,9,20,8,59,59));assert.equal((await service.doses('2026-10-20','2026-10-21'))[0].status,'due');
  clock(new Date(2026,9,20,9));assert.equal((await service.doses('2026-10-20','2026-10-21'))[0].status,'missed');
  assert.equal((await repository.logs('2026-10-20','2026-10-21')).length,0);
});

test('schedule edits retain old occurrences, snapshots and logs without duplicating today',async(t)=>{
  const {service,clock,repository}=await fixture(t);let medicine=await service.save(null,input());const old=(await service.doses('2026-10-20','2026-10-21'))[0];
  await service.record(old.id,'taken');clock(new Date(2026,9,20,12));medicine=await service.save(medicine.id,input({name:'Renamed',instructions:'New mock instruction',schedules:[schedule({times:['08:00','18:00']})]}),medicine.revision);
  const doses=await service.doses('2026-10-20','2026-10-21');assert.deepEqual(doses.map((dose)=>dose.local),['2026-10-20T08:00','2026-10-20T18:00']);
  assert.equal(doses[0].id,old.id);assert.equal(doses[0].name,'Fictional test medicine');assert.equal(doses[0].instructions,'Fictional instruction');assert.equal(doses[0].status,'taken');assert.equal(doses[1].name,'Renamed');
  assert.equal((await repository.schedules('2026-10-20','2026-10-21')).length,2);
  const before=doses[1].id;await service.save(medicine.id,{...medicine,notes:'Only notes changed'},medicine.revision);assert.equal((await service.doses('2026-10-20','2026-10-21'))[1].id,before);
});

test('deactivate/reactivate cancels future occurrences while preserving missed history and definitions',async(t)=>{
  const {service,clock}=await fixture(t);let med=await service.save(null,input());clock(new Date(2026,9,20,12));
  med=await service.save(med.id,{...med,active:false},med.revision);
  assert.equal((await service.list('','active')).length,0);assert.equal((await service.list('','inactive')).length,1);
  assert.deepEqual((await service.doses('2026-10-20','2026-10-22')).map((dose)=>dose.local),['2026-10-20T08:00']);
  clock(new Date(2026,9,20,15));await service.save(med.id,{...med,active:true},med.revision);
  assert.deepEqual((await service.doses('2026-10-20','2026-10-21')).map((dose)=>dose.local),['2026-10-20T08:00','2026-10-20T20:00']);
});

test('Medicine and schedule writes roll back atomically on constraint failure',async(t)=>{
  const {service,db}=await fixture(t);const med=await service.save(null,input());
  await db.execAsync("CREATE TRIGGER medicine_test_failure BEFORE INSERT ON medicine_schedules BEGIN SELECT RAISE(ABORT,'test rejection'); END;");
  await assert.rejects(service.save(med.id,input({name:'Must roll back'}),med.revision));
  assert.deepEqual(await service.get(med.id),med);assert.equal((await service.doses('2026-10-20','2026-10-21')).length,2);
});

test('dose history cannot be cascaded away and rejects mismatched parents, duplicate slots and invented statuses',async(t)=>{
  const {service,db}=await fixture(t);const medicine=await service.save(null,input());const other=await service.save(null,input({name:'Other fictional medicine'}));
  const dose=(await service.doses('2026-10-20','2026-10-21',medicine.id))[0];await service.record(dose.id,'taken');
  await assert.rejects(db.runAsync('DELETE FROM medicines WHERE id=?',medicine.id),/FOREIGN KEY/);
  await assert.rejects(db.runAsync('DELETE FROM medicine_schedules WHERE id=?',dose.scheduleId),/FOREIGN KEY/);
  await assert.rejects(db.runAsync('UPDATE medicine_dose_logs SET medicine_id=? WHERE occurrence_id=?',other.id,dose.id),/FOREIGN KEY/);
  await assert.rejects(db.runAsync("UPDATE medicine_dose_logs SET status='missed' WHERE occurrence_id=?",dose.id),/CHECK/);
  await assert.rejects(db.runAsync("INSERT INTO medicine_dose_logs SELECT 'another-id',schedule_id,medicine_id,scheduled_local,scheduled_at,timezone,status,action_at,name_snapshot,instructions_snapshot FROM medicine_dose_logs WHERE occurrence_id=?",dose.id),/UNIQUE/);
  assert.equal((await service.doses('2026-10-20','2026-10-21',medicine.id))[0].status,'taken');
});

test('edits exactly on a dose boundary and after a clock rollback never duplicate historical slots',async(t)=>{
  const {service,clock}=await fixture(t);let medicine=await service.save(null,input());
  clock(new Date(2026,9,20,20));const original=(await service.doses('2026-10-20','2026-10-21'))[1];await service.record(original.id,'taken');
  medicine=await service.save(medicine.id,{...medicine,name:'Renamed at boundary'},medicine.revision);
  let doses=await service.doses('2026-10-20','2026-10-21');assert.equal(doses.length,2);assert.equal(doses[1].id,original.id);assert.equal(doses[1].status,'taken');
  clock(new Date(2026,9,20,10));await service.save(medicine.id,{...medicine,name:'Clock rollback fixture'},medicine.revision);
  doses=await service.doses('2026-10-20','2026-10-21');assert.equal(doses.length,2);assert.equal(doses[1].id,original.id);
});

test('migration 6 preserves preexisting records and remains idempotent; failed next migration rolls back',async(t)=>{
  const db=openTestDatabase();t.after(()=>db.closeAsync());await initializeDatabase(db,migrations.slice(0,5));
  await db.runAsync('INSERT INTO notes(id,title,body,created_at,updated_at) VALUES(?,?,?,?,?)','old-note','Old note','Synthetic','2026','2026');
  await db.runAsync('INSERT INTO app_settings(key,value,created_at,updated_at) VALUES(?,?,?,?)','medicine-test','synthetic','2026','2026');
  await initializeDatabase(db);const repository=createMedicineRepository(db,randomUUID);const service=createMedicineService(repository,()=>new Date(2026,9,20,9));const med=await service.save(null,input());
  await initializeDatabase(db);assert.deepEqual(await service.get(med.id),med);assert.equal((await db.getFirstAsync('SELECT title FROM notes WHERE id=?','old-note')).title,'Old note');
  assert.equal((await db.getFirstAsync('SELECT value FROM app_settings WHERE key=?','medicine-test')).value,'synthetic');
  await assert.rejects(applyMigrations(db,[...migrations,{version:migrations.length+1,name:'bad-test',sql:'CREATE TABLE test_rollback(id); INSERT INTO missing_table VALUES(1);'}]),{code:'MIGRATION'});
  assert.equal(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name='test_rollback'"),null);assert.equal((await db.getAllAsync('SELECT * FROM schema_migrations')).length,migrations.length);
});

test('invalid form inputs, duplicate slots and unsafe identifiers fail without writes',async(t)=>{
  const {service,db}=await fixture(t);
  for(const value of [null,{},input({name:' '}),input({name:'x'.repeat(241)}),input({active:1}),input({endDate:'2026-02-30'}),input({startDate:'2026-10-22',endDate:'2026-10-21'}),input({schedules:[schedule({times:['25:00']})]}),input({schedules:[schedule({times:['08:00','08:00']})]}),input({schedules:[schedule({weekdays:[]})]}),input({schedules:[schedule(),schedule()]}),input({startDate:'2026-10-24',schedules:[schedule({endDate:'2026-10-23'})]})]) await assert.rejects(service.save(null,value),{code:'VALIDATION'});
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM medicines')).n,0);
  await assert.rejects(service.get('../bad'),{code:'VALIDATION'});await assert.rejects(service.doses('2026-01-01','2027-01-01'),{code:'RANGE'});
  await assert.rejects(service.record('invalid','taken'),{code:'VALIDATION'});assert.deepEqual(validateMedicine(input({schedules:[]})).schedules,[]);
});

test('reminder reconciliation is idempotent and never cancels unrelated notifications or logs doses',async(t)=>{
  const {service,repository}=await fixture(t);await service.save(null,input());const native=fakeNotifications();native.pending.set('other',{id:'other',owner:'other-feature'});
  const engine=createMedicineReconciler(repository,native.adapter);const doses=await service.doses('2026-10-20','2026-10-22');const now=new Date(2026,9,20,9);
  await engine.reconcile(doses,now);await engine.reconcile(doses,now);
  assert.equal(native.pending.size,4);assert.equal((await repository.jobs()).length,3);assert.equal(native.cancelled.length,0);
  assert.equal((await repository.logs('2026-10-20','2026-10-22')).length,0);
  await engine.reconcile([],now);assert.equal(native.pending.size,1);assert.ok(native.pending.has('other'));assert.equal((await repository.jobs()).length,0);
});

test('permission denial clears only medicine reminders; granted exact fallback updates native jobs',async(t)=>{
  const {service,repository}=await fixture(t);await service.save(null,input());const native=fakeNotifications();const engine=createMedicineReconciler(repository,native.adapter);const doses=await service.doses('2026-10-20','2026-10-21');const now=new Date(2026,9,20,9);
  const fallback=await engine.reconcile(doses,now);assert.equal(fallback.exact,false);assert.equal([...native.pending.values()][0].delivery,'bestEffort');
  native.setPermissions({granted:true,exact:true});await engine.reconcile(doses,now);assert.equal([...native.pending.values()][0].delivery,'alarmClock');assert.equal(native.cancelled.length,1);
  native.setPermissions({granted:false,exact:true});await engine.reconcile(doses,now);assert.equal(native.pending.size,0);assert.equal((await repository.jobs()).length,0);
  native.setPermissions({granted:true,exact:false});await engine.reconcile(doses,now);assert.equal(native.pending.size,1);
});

test('schedule changes and dose actions reconcile stale jobs without duplicates',async(t)=>{
  const {service,repository,clock}=await fixture(t);let med=await service.save(null,input());const native=fakeNotifications();const engine=createMedicineReconciler(repository,native.adapter);
  await engine.reconcile(await service.doses('2026-10-20','2026-10-22'),new Date(2026,9,20,9));const old=[...native.pending.keys()];
  clock(new Date(2026,9,20,12));await service.save(med.id,input({schedules:[schedule({times:['18:00']})]}),med.revision);
  await engine.reconcile(await service.doses('2026-10-20','2026-10-22'),new Date(2026,9,20,12));assert.ok(old.every((id)=>native.cancelled.includes(id)));assert.equal(native.pending.size,2);
  clock(new Date(2026,9,20,18,1));const dose=(await service.doses('2026-10-20','2026-10-21')).at(-1);await service.record(dose.id,'taken');
  await engine.reconcile(await service.doses('2026-10-20','2026-10-22'),new Date(2026,9,20,18,1));assert.equal(native.pending.size,1);
});

test('native scheduling survives a ledger-write interruption with stable notification identity',async(t)=>{
  const {service,repository}=await fixture(t);await service.save(null,input());const native=fakeNotifications();let fail=true;
  const interrupted={...repository,putJob:async(...args)=>{if(fail){fail=false;throw new Error('Synthetic disk failure');}return repository.putJob(...args);}};
  const engine=createMedicineReconciler(interrupted,native.adapter);const doses=await service.doses('2026-10-20','2026-10-21');const now=new Date(2026,9,20,9);
  await assert.rejects(engine.reconcile(doses,now),/disk failure/);assert.equal(native.pending.size,1);
  await engine.reconcile(doses,now);assert.equal(native.pending.size,1);assert.equal((await repository.jobs()).length,1);
  native.pending.clear();await engine.reconcile(doses,now);assert.equal(native.pending.size,1);
});

test('foreground rearming repairs OS-cleared alarms even when Expo still lists persisted requests',async(t)=>{
  const {service,repository}=await fixture(t);await service.save(null,input());const native=fakeNotifications();let schedules=0;
  const adapter={...native.adapter,schedule:async(...args)=>{schedules++;return native.adapter.schedule(...args);}};
  const engine=createMedicineReconciler(repository,adapter);const doses=await service.doses('2026-10-20','2026-10-21');const now=new Date(2026,9,20,9);
  await engine.reconcile(doses,now);assert.equal(schedules,1);const ledger=await repository.jobs();
  await engine.reconcile(doses,now);assert.equal(schedules,1);
  // Persisted request remains present, but Android may have removed its alarm.
  await engine.reconcile(doses,now,{rearm:true});assert.equal(schedules,2);assert.equal(native.pending.size,1);assert.deepEqual(await repository.jobs(),ledger);
});

test('rolling notification queue is capped visibly; cancellation errors are surfaced and retryable',async(t)=>{
  const {service,repository}=await fixture(t);await service.save(null,input({schedules:[schedule({times:Array.from({length:12},(_,i)=>`${String(i).padStart(2,'0')}:00`)})]}));
  await service.save(null,input({name:'Another fictional test medicine',schedules:[schedule({times:Array.from({length:12},(_,i)=>`${String(i).padStart(2,'0')}:30`)})]}));
  const native=fakeNotifications();const engine=createMedicineReconciler(repository,native.adapter);const doses=await service.doses('2026-10-20','2026-11-05');const now=new Date(2026,9,20,9);
  const result=await engine.reconcile(doses,now);assert.equal(result.pending,100);assert.equal(result.limited,true);assert.equal(native.pending.size,100);
  assert.ok([...native.pending.values()].every((item)=>item.occurrenceId.split('/')[1]<'2026-10-27T00:00'));
  const broken=createMedicineReconciler(repository,{...native.adapter,cancel:async()=>{throw new Error('Native cancellation failed');}});await assert.rejects(broken.reconcile([],now),/cancellation failed/);
  await engine.reconcile([],now);assert.equal(native.pending.size,0);
});

test('DST spring gaps are skipped and fall-back duplicates produce one stable occurrence',()=>{
  const root=dirname(require.resolve('../../package.json'));
  const result=spawnSync(process.execPath,['-e',`
    const assert=require('node:assert/strict');const {generateDoses}=require('./src/features/medicine/services/doseOccurrences.js');
    const schedule={id:'dst',medicineId:'mock',weekdays:[0,1,2,3,4,5,6],times:['02:30'],startDate:null,endDate:null,effectiveFrom:'2026-01-01T00:00:00.000',retiredAt:null,enabled:true,current:true,name:'Synthetic',instructions:''};
    assert.deepEqual(generateDoses([schedule],'2026-03-07','2026-03-10',new Date(2026,2,10)).map(d=>d.local),['2026-03-07T02:30','2026-03-09T02:30']);
    const repeated=generateDoses([{...schedule,times:['01:30']}],'2026-11-01','2026-11-02',new Date(2026,10,2));assert.equal(repeated.length,1);assert.equal(repeated[0].scheduledAt,'2026-11-01T05:30:00.000Z');
  `],{cwd:root,env:{...process.env,TZ:'America/New_York'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

test('generation validates malformed stored schedules and bounds work before iteration',()=>{
  assert.throws(()=>generateDoses([], '2026-01-01','2027-01-01',new Date()),{code:'RANGE'});
  assert.throws(()=>generateDoses([{...schedule(),times:['bad']}],'2026-10-20','2026-10-21',new Date()),{code:'VALIDATION'});
});

test('medicine definitions, logs and notification IDs persist across a separate offline process',async(t)=>{
  const folder=mkdtempSync(join(tmpdir(),'maivelle-med-'));const file=join(folder,'medicine.db');
  t.after(()=>{assert.equal(dirname(resolve(folder)),resolve(tmpdir()));assert.match(basename(folder),/^maivelle-med-/);rmSync(folder,{recursive:true,force:true});});
  const db=openTestDatabase(file);await initializeDatabase(db);const repository=createMedicineRepository(db,randomUUID);const service=createMedicineService(repository,()=>new Date(2026,9,20,9));const med=await service.save(null,input());const dose=(await service.doses('2026-10-20','2026-10-21'))[0];await service.record(dose.id,'taken');await repository.putJob(dose,'native-test-id','bestEffort');await db.closeAsync();
  const script=`const assert=require('node:assert/strict');const {openTestDatabase}=require('./tests/database/sqliteAdapter.cjs');const db=openTestDatabase(process.argv[1]);assert.equal(db.native.prepare('SELECT name FROM medicines WHERE id=?').get(process.argv[2]).name,'Fictional test medicine');assert.equal(db.native.prepare('SELECT status FROM medicine_dose_logs').get().status,'taken');assert.equal(db.native.prepare('SELECT notification_id FROM medicine_notification_jobs').get().notification_id,'native-test-id');db.closeAsync();`;
  const child=spawnSync(process.execPath,['-e',script,file,med.id],{cwd:dirname(require.resolve('../../package.json')),encoding:'utf8'});assert.equal(child.status,0,child.stderr);
});
