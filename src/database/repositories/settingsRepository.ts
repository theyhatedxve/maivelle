import {
  preferenceDefaults,
  validatePreference,
} from '../../features/settings/model/preferences.ts';
const PREFIX = 'preferences.v1.';
/** Reuse app_settings; no second preferences store or migration needed. */
export function createSettingsRepository(db: import('../types.ts').Database) {
  return {
    async read() {
      const result = { ...preferenceDefaults };
      const rows = await db.getAllAsync<Pick<import('../rows.ts').AppSettingsRow, 'key' | 'value'>>(
        'SELECT key,value FROM app_settings WHERE key LIKE ?',
        `${PREFIX}%`,
      );
      for (const row of rows) {
        const key = row.key.slice(PREFIX.length);
        if (!Object.hasOwn(result, key)) continue;
        const value = JSON.parse(row.value);
        validatePreference(key, value);
        Object.assign(result, { [key]: value });
      }
      return result as import('../../features/settings/model/preferences.ts').Preferences;
    },

    async write(key: string, value: unknown) {
      validatePreference(key, value);
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO app_settings(key,value,created_at,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=MAX(app_settings.updated_at,excluded.updated_at)`,
        PREFIX + key,
        JSON.stringify(value),
        now,
        now,
      );
    },
  };
}
