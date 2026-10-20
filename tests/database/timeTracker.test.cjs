const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname, basename } = require('node:path');
const { spawnSync } = require('node:child_process');
const { openTestDatabase } = require('./sqliteAdapter.cjs');
const { initializeDatabase } = require('../../src/database/initialize.js');
const { migrations } = require('../../src/database/migrations/index.js');
const {
  createTimeTrackerRepository,
} = require('../../src/database/repositories/timeTrackerRepository.js');
const {
  createTimeTrackerService,
} = require('../../src/features/timeTracker/services/timeTrackerService.js');
const {
  aggregateTime,
  periods,
  formatDuration,
} = require('../../src/features/timeTracker/services/timeAnalytics.js');
const {
  instant,
} = require('../../src/features/timeTracker/validation/timeInput.js');

async function fixture(t) {
  const db = openTestDatabase();
  t.after(() => db.closeAsync());
  await initializeDatabase(db);
  let now = Date.parse('2026-10-20T08:00:00.000Z');
  const repository = createTimeTrackerRepository(db, randomUUID);
  const service = createTimeTrackerService(repository, () => now);
  const projectId = await service.saveProject(null, {
    name: 'Synthetic activity',
    description: 'Fixture only',
    color: '#6D42C7',
    archived: false,
  });
  return {
    db,
    repository,
    service,
    projectId,
    advance: (ms) => {
      now += ms;
    },
    now: () => now,
    manual: (start, end, title = 'Manual fixture') => ({
      title,
      projectId,
      segments: [
        {
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
        },
      ],
    }),
  };
}
test('timer start/pause/resume cycles/stop exclude paused time and preserve created_at', async (t) => {
  const f = await fixture(t);
  let s = await f.service.start(f.projectId, 'Synthetic focus');
  const created = s.created_at;
  f.advance(10000);
  s = await f.service.transition(s, 'pause');
  f.advance(5000);
  s = await f.service.transition(s, 'resume');
  f.advance(20000);
  s = await f.service.transition(s, 'pause');
  f.advance(5000);
  s = await f.service.transition(s, 'resume');
  f.advance(30000);
  s = await f.service.transition(s, 'stop');
  assert.equal(s.status, 'completed');
  assert.equal(s.segments.length, 3);
  assert.equal(s.created_at, created);
  assert.equal(s.updated_at, new Date(f.now()).toISOString());
  assert.equal((await f.service.history({}))[0].duration_ms, 60000);
  assert.equal((await f.service.summary()).today.totalMs, 60000);
  await assert.rejects(f.service.transition(s, 'stop'), { code: 'CONFLICT' });
});
test('one active session; simultaneous double taps and stale revisions cannot duplicate segments', async (t) => {
  const f = await fixture(t);
  const results = await Promise.allSettled([
    f.service.start(f.projectId, 'One'),
    f.service.start(f.projectId, 'Two'),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const s = await f.service.active();
  await assert.rejects(f.service.start(f.projectId, 'Third'), {
    code: 'CONFLICT',
  });
  f.advance(100);
  const paused = await f.service.transition(s, 'pause');
  await assert.rejects(f.service.transition(s, 'pause'), { code: 'CONFLICT' });
  const results2 = await Promise.allSettled([
    f.service.transition(paused, 'resume'),
    f.service.transition(paused, 'resume'),
  ]);
  assert.equal(results2.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await f.service.active()).segments.length, 2);
  assert.equal(
    (
      await f.db.getFirstAsync(
        'SELECT COUNT(*) n FROM time_session_segments WHERE end_ms IS NULL'
      )
    ).n,
    1
  );
});
test('stop while paused adds no paused time; discard removes segments atomically', async (t) => {
  const f = await fixture(t);
  let s = await f.service.start(f.projectId, 'Paused');
  f.advance(1000);
  s = await f.service.transition(s, 'pause');
  f.advance(100000);
  s = await f.service.transition(s, 'stop');
  assert.equal((await f.service.history({}))[0].duration_ms, 1000);
  await assert.rejects(f.service.remove(s, true), { code: 'CONFLICT' });
  await f.service.remove(s);
  s = await f.service.start(f.projectId, 'Discard');
  await assert.rejects(f.service.remove(s), { code: 'CONFLICT' });
  await f.service.remove(s, true);
  assert.equal(await f.service.active(), null);
  assert.equal(
    (await f.db.getFirstAsync('SELECT COUNT(*) n FROM time_session_segments'))
      .n,
    0
  );
});
test('background/reconstructed service elapsed derives from persisted starts without ticks', async (t) => {
  const f = await fixture(t);
  const s = await f.service.start(f.projectId, 'Persist');
  f.advance(3600000);
  const recovered = createTimeTrackerService(
    createTimeTrackerRepository(f.db, randomUUID),
    f.now
  );
  assert.equal((await recovered.active()).id, s.id);
  assert.equal((await recovered.summary()).today.totalMs, 3600000);
  await recovered.transition(await recovered.active(), 'stop');
});
test('clock rollback clamps provisional analytics and requires explicit reviewed recovery', async (t) => {
  const f = await fixture(t);
  const s = await f.service.start(f.projectId, 'Clock');
  f.advance(-60000);
  assert.equal((await f.service.summary()).today.totalMs, 0);
  await assert.rejects(f.service.transition(s, 'pause'), { code: 'CLOCK' });
  await assert.rejects(
    f.service.recover(s, new Date(s.segments[0].start_ms - 1).toISOString()),
    { code: 'VALIDATION' }
  );
  const ended = await f.service.recover(
    s,
    new Date(s.segments[0].start_ms).toISOString()
  );
  assert.equal(ended.status, 'completed');
  assert.equal(ended.segments[0].end_ms, ended.segments[0].start_ms);
});
test('reviewed recovery cuts a forward clock estimate to the chosen real end', async (t) => {
  const f = await fixture(t);
  const s = await f.service.start(f.projectId, 'Forward');
  f.advance(86400000);
  const end = s.segments[0].start_ms + 5000;
  await f.service.recover(s, new Date(end).toISOString());
  assert.equal((await f.service.history({}))[0].duration_ms, 5000);
});
test('manual CRUD preserves identity, creation timestamp, source type and optimistic conflicts', async (t) => {
  const f = await fixture(t);
  const input = f.manual(
    f.now() - 3600000,
    f.now() - 1800000,
    "'); DROP TABLE notes; --"
  );
  const s = await f.service.saveSession(null, null, input);
  f.advance(1000);
  const updated = await f.service.saveSession(s.id, s.revision, {
    ...input,
    title: 'Edited',
    segments: [
      { start: input.segments[0].start, end: new Date(f.now()).toISOString() },
    ],
  });
  assert.equal(updated.id, s.id);
  assert.equal(updated.type, 'manual');
  assert.equal(updated.created_at, s.created_at);
  assert.notEqual(updated.updated_at, s.updated_at);
  await assert.rejects(f.service.saveSession(s.id, s.revision, input), {
    code: 'CONFLICT',
  });
  await f.service.remove(updated);
  assert.equal(await f.service.get(s.id), null);
});
test('timer history timestamp editing preserves separate pauses and timer source type', async (t) => {
  const f = await fixture(t);
  let s = await f.service.start(f.projectId, 'Segments');
  f.advance(1000);
  s = await f.service.transition(s, 'pause');
  f.advance(1000);
  s = await f.service.transition(s, 'resume');
  f.advance(1000);
  s = await f.service.transition(s, 'stop');
  const input = {
    title: 'Retimed',
    projectId: f.projectId,
    segments: s.segments.map((g) => ({
      start: new Date(g.start_ms).toISOString(),
      end: new Date(g.end_ms).toISOString(),
    })),
  };
  const edit = await f.service.saveSession(s.id, s.revision, input);
  assert.equal(edit.type, 'timer');
  assert.equal(edit.segments.length, 2);
  assert.equal((await f.service.history({}))[0].duration_ms, 2000);
});
test('activity edit/archive/delete preserves session history and totals', async (t) => {
  const f = await fixture(t);
  const s = await f.service.saveSession(
    null,
    null,
    f.manual(f.now() - 1000, f.now())
  );
  await f.service.saveProject(f.projectId, {
    name: 'Renamed',
    description: 'Changed',
    color: '#2563EB',
    archived: true,
  });
  assert.equal((await f.service.projects())[0].total_ms, 1000);
  await assert.rejects(f.service.start(f.projectId, 'Archived'), {
    code: 'REFERENCE',
  });
  assert.equal(
    (
      await f.service.saveSession(
        s.id,
        s.revision,
        f.manual(f.now() - 1000, f.now())
      )
    ).project_id,
    f.projectId
  );
  await f.service.deleteProject(f.projectId);
  const retained = await f.service.get(s.id);
  assert.equal(retained.project_id, null);
  assert.equal(retained.segments.length, 1);
  assert.equal(retained.project_name, 'Renamed');
  assert.equal((await f.service.summary()).today.totalMs, 1000);
});
test('cannot delete activity of active timer; archive leaves timer usable', async (t) => {
  const f = await fixture(t);
  const s = await f.service.start(f.projectId, 'Running');
  await assert.rejects(f.service.deleteProject(f.projectId), {
    code: 'CONFLICT',
  });
  await f.service.saveProject(f.projectId, {
    name: 'Archived',
    description: '',
    color: '#6D42C7',
    archived: true,
  });
  f.advance(1000);
  await f.service.transition(s, 'stop');
  assert.equal((await f.service.history({})).length, 1);
});
test('history filters activity/type/overlap range, deterministic pagination', async (t) => {
  const f = await fixture(t);
  await f.service.saveSession(
    null,
    null,
    f.manual(f.now() - 10000, f.now() - 5000)
  );
  const timer = await f.service.start(f.projectId, 'Timer');
  f.advance(1000);
  await f.service.transition(timer, 'stop');
  assert.equal((await f.service.history({ type: 'manual' })).length, 1);
  assert.equal(
    (await f.service.history({ type: 'timer', projectId: f.projectId })).length,
    1
  );
  assert.equal(
    (await f.service.history({ from: f.now() - 7000, to: f.now() - 6500 }))
      .length,
    1
  );
  assert.equal(
    (await f.service.history({ limit: 1, offset: 1 }))[0].type,
    'manual'
  );
  await assert.rejects(f.service.history({ limit: 0 }), { code: 'VALIDATION' });
  await assert.rejects(f.service.history({ from: 2, to: 1 }), {
    code: 'VALIDATION',
  });
});
test('rejects empty title, malformed/negative/future/overlapping timestamps and invalid activity', async (t) => {
  const f = await fixture(t);
  for (const input of [
    { ...f.manual(0, 1), title: ' ' },
    f.manual(2000, 1000),
    f.manual(f.now(), f.now() + 1),
    { ...f.manual(0, 1), segments: [] },
    {
      ...f.manual(0, 1),
      segments: [{ start: '2026-02-30T00:00:00.000Z', end: 'x' }],
    },
    {
      ...f.manual(0, 1),
      segments: [
        { start: new Date(0).toISOString(), end: new Date(2000).toISOString() },
        {
          start: new Date(1000).toISOString(),
          end: new Date(3000).toISOString(),
        },
      ],
    },
  ])
    await assert.rejects(f.service.saveSession(null, null, input), {
      code: 'VALIDATION',
    });
  await assert.rejects(f.service.start(f.projectId, ''), {
    code: 'VALIDATION',
  });
  await assert.rejects(
    f.service.saveSession(null, null, {
      ...f.manual(0, 1),
      projectId: 'missing',
    }),
    { code: 'REFERENCE' }
  );
  await assert.rejects(
    f.service.saveProject(null, {
      name: '',
      description: '',
      color: 'red',
      archived: false,
    }),
    { code: 'VALIDATION' }
  );
  await assert.rejects(
    f.service.saveProject(null, {
      name: 'Valid',
      description: '',
      color: '#GGGGGG',
      archived: false,
    }),
    { code: 'VALIDATION' }
  );
  assert.equal((await f.service.history({})).length, 0);
  assert.throws(() => instant('2026-10-20T00:00:00+08:00'), {
    code: 'VALIDATION',
  });
});
test('database enforces only one active timer, open segment, valid ranges and references', async (t) => {
  const f = await fixture(t);
  const s = await f.service.start(f.projectId, 'Constraint');
  const start = s.segments[0].start_ms;
  await assert.rejects(
    f.db.runAsync(
      'INSERT INTO time_session_segments VALUES(?,?,?,?)',
      randomUUID(),
      s.id,
      start + 1,
      null
    ),
    /overlap|UNIQUE/
  );
  await assert.rejects(
    f.db.runAsync(
      'INSERT INTO time_session_segments VALUES(?,?,?,?)',
      randomUUID(),
      s.id,
      start,
      start - 1
    ),
    /CHECK/
  );
  await assert.rejects(
    f.db.runAsync(
      'INSERT INTO time_session_segments VALUES(?,?,?,?)',
      randomUUID(),
      'missing',
      start,
      start + 1
    ),
    /Missing|FOREIGN/
  );
  await assert.rejects(
    f.db.runAsync(
      "UPDATE time_sessions SET status='completed' WHERE id=?",
      s.id
    ),
    /Close/
  );
  await assert.rejects(
    f.db.runAsync(
      "INSERT INTO time_sessions(id,project_name,project_color,title,type,status,created_at,updated_at) VALUES(?,'x','#6D42C7','x','timer','paused','x','x')",
      randomUUID()
    ),
    /UNIQUE/
  );
});
test('failed multi-record save rolls back parent and all segments', async (t) => {
  const f = await fixture(t);
  const s = await f.service.saveSession(null, null, f.manual(0, 1000));
  await assert.rejects(
    f.repository.saveSession(
      s.id,
      s.revision,
      {
        title: 'Must rollback',
        projectId: f.projectId,
        segments: [
          { start: 0, end: 2000 },
          { start: 1000, end: 3000 },
        ],
      },
      f.now()
    )
  );
  assert.deepEqual(await f.service.get(s.id), s);
});
test('local midnight splits exact integer milliseconds and counts a multi-segment session once', () => {
  const midnight = new Date(2026, 9, 20).getTime();
  const base = {
    id: 's',
    project_id: 'p',
    project_name: 'Test',
    project_color: '#6D42C7',
    type: 'timer',
    status: 'completed',
  };
  const stats = aggregateTime(
    [
      { ...base, start_ms: midnight - 1000, end_ms: midnight + 2000 },
      { ...base, start_ms: midnight + 3000, end_ms: midnight + 4000 },
    ],
    midnight - 2000,
    midnight + 5000,
    midnight + 5000
  );
  assert.equal(stats.totalMs, 4000);
  assert.equal(stats.sessionCount, 1);
  assert.deepEqual(
    stats.days.map((d) => d.durationMs),
    [1000, 3000]
  );
  assert.equal(stats.projects[0].sessionCount, 1);
  assert.equal(formatDuration(360000000), '100:00:00');
  assert.equal(formatDuration(-1000), '00:00:00');
});
test('daily/weekly/monthly summaries clip boundaries and aggregate activity distribution', async (t) => {
  const f = await fixture(t);
  const p = periods(f.now());
  await f.service.saveSession(null, null, f.manual(p.day - 1000, p.day + 1000));
  const summary = await f.service.summary();
  assert.equal(summary.today.totalMs, 1000);
  assert.equal(summary.week.totalMs, 2000);
  assert.equal(summary.month.totalMs, 2000);
  assert.equal(summary.today.projects[0].durationMs, 1000);
});
test('DST grouping uses 23 and 25 hour local days', () => {
  const script = `const assert=require('node:assert/strict');const {aggregateTime,dayStart}=require('./src/features/timeTracker/services/timeAnalytics.js');for(const [month,day,hours] of [[2,8,23],[10,1,25]]){const start=new Date(2026,month,day).getTime(),end=new Date(2026,month,day+1).getTime();const s=aggregateTime([{id:'s',project_id:'p',project_name:'P',project_color:'#6D42C7',type:'manual',status:'completed',start_ms:start,end_ms:end}],start,end,end);assert.equal(s.totalMs,hours*3600000);assert.equal(s.days.length,1);}`;
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    env: { ...process.env, TZ: 'America/New_York' },
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
});
test('migration 7 preserves old Notes/Tasks/Medicine data, ledger is idempotent and new records survive reopening', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'maivelle-time-test-'));
  const filename = join(directory, 'persistence.db');
  let db;
  try {
    db = openTestDatabase(filename);
    await initializeDatabase(db, migrations.slice(0, 6));
    await db.runAsync(
      "INSERT INTO notes(id,title,body,created_at,updated_at) VALUES('old-note','Keep','Fixture','a','a')"
    );
    await db.runAsync(
      "INSERT INTO tasks(id,title,description,priority,status,created_at,updated_at) VALUES('old-task','Keep','','medium','todo','a','a')"
    );
    await db.runAsync(
      "INSERT INTO medicines(id,name,active,created_at,updated_at) VALUES('old-medicine','Fictional',0,'a','a')"
    );
    await initializeDatabase(db);
    const before = await db.getAllAsync('SELECT * FROM schema_migrations');
    await initializeDatabase(db);
    assert.deepEqual(
      await db.getAllAsync('SELECT * FROM schema_migrations'),
      before
    );
    let repo = createTimeTrackerRepository(db, randomUUID);
    const now = Date.now();
    const id = await repo.saveProject(
      null,
      { name: 'Persist', description: '', color: '#6D42C7', archived: false },
      now
    );
    const s = await repo.start(id, 'Restart fixture', now);
    await db.closeAsync();
    db = null;
    const child = spawnSync(
      process.execPath,
      [
        '-e',
        `const {openTestDatabase}=require('./tests/database/sqliteAdapter.cjs');const db=openTestDatabase(process.argv[1]);db.getFirstAsync("SELECT id FROM time_sessions WHERE status='running'").then(row=>{process.stdout.write(row.id);return db.closeAsync();});`,
        filename,
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout, s.id);
    db = openTestDatabase(filename);
    await initializeDatabase(db);
    repo = createTimeTrackerRepository(db, randomUUID);
    assert.equal((await repo.active()).id, s.id);
    assert.equal((await repo.active()).segments[0].start_ms, now);
    assert.equal(
      (await db.getFirstAsync("SELECT title FROM notes WHERE id='old-note'"))
        .title,
      'Keep'
    );
    assert.equal(
      (await db.getFirstAsync("SELECT title FROM tasks WHERE id='old-task'"))
        .title,
      'Keep'
    );
    assert.equal(
      (
        await db.getFirstAsync(
          "SELECT name FROM medicines WHERE id='old-medicine'"
        )
      ).name,
      'Fictional'
    );
    await repo.transition(s.id, s.revision, 'stop', now + 1000);
    assert.equal((await repo.history({}))[0].duration_ms, 1000);
  } finally {
    if (db) await db.closeAsync();
    assert.equal(resolve(dirname(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('maivelle-time-test-'));
    rmSync(directory, { recursive: true });
  }
});

test('paused stop after clock rollback adds no duration; bad actions and IDs fail', async (t) => {
  const f = await fixture(t);
  let session = await f.service.start(f.projectId, 'Pause rollback');
  f.advance(1000);
  session = await f.service.transition(session, 'pause');
  f.advance(-5000);
  await assert.rejects(
    f.repository.transition(session.id, session.revision, 'toggle', f.now()),
    { code: 'VALIDATION' }
  );
  session = await f.service.transition(session, 'stop');
  assert.equal(session.status, 'completed');
  assert.equal((await f.service.history({}))[0].duration_ms, 1000);
  await assert.rejects(f.service.get("' OR 1=1"), { code: 'VALIDATION' });
});

test('history pagination covers more than one FlatList page without duplication', async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 61; i++)
    await f.service.saveSession(
      null,
      null,
      f.manual(f.now() - 10000 - i * 10, f.now() - 9000 - i * 10, `Sample ${i}`)
    );
  const first = await f.service.history({ limit: 50 });
  const second = await f.service.history({ offset: 50, limit: 50 });
  assert.equal(first.length, 50);
  assert.equal(second.length, 11);
  assert.equal(new Set([...first, ...second].map((row) => row.id)).size, 61);
});
