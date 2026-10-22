// Host CPU/query observations are not Android frame or memory measurements.
const { randomUUID } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { openTestDatabase } = require('../tests/database/sqliteAdapter.cts');
const { measureModuleQueries } = require('../src/testing/database/phase13Scenarios.ts');
(async () => {
  const db = openTestDatabase();
  try {
    const metrics = await measureModuleQueries(db, randomUUID);
    console.log(JSON.stringify(metrics, null, 2));
    if (process.argv[2])
      writeFileSync(
        process.argv[2],
        JSON.stringify(
          {
            runtime: process.version,
            fixture: '1000 notes ~8KiB, 1000 tasks; 5 samples',
            metrics,
          },
          null,
          2,
        ),
      );
  } finally {
    await db.closeAsync();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
