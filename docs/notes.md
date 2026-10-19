# Notes — Phase 4

Notes runs locally through the Phase 3 SQLite connection. **The development database is unencrypted and accepts nonsensitive fixtures only.** The existing production encryption gate, SQLCipher plugin, SecureStore configuration, disabled Android backups, database filename and branding assets are preserved. SQLCipher support alone does not encrypt notes. Production key provisioning and recovery remain unresolved; see [local-database.md](local-database.md).

## Screens and behavior

- `/notes`: paginated FlatList library, title/content search, Active/Archived filters, category filters, pinned records first, modified dates, previews, pull-to-refresh, and a floating Create note button.
- `/notes/new`: create a note with an optional category. A title or nonblank content is required. Content-only notes receive `Untitled note`. Titles allow 240 characters and content allows 100000 characters.
- `/notes/[id]`: load and edit by stable ID. Missing or malformed IDs show a recovery state. Loading failures block editing and offer retry. Saves update the same row and preserve `created_at`.

Back navigation with unsaved changes offers Keep editing or Discard. Saving blocks repeated submissions and prevents navigation during the write. Successful saves dismiss the editor to the library. Pin/unpin and archive/restore are explicit buttons; Delete always opens a native confirmation dialog. Cancelling leaves SQLite untouched.

Categories are optional. Create a category in the editor, then assign it or choose Uncategorized. Category creation persists independently of the note; discarding an editor does not delete a category already created. Category names are trimmed, unique, and limited to 80 characters. Category renaming/deletion is outside this phase. Existing category foreign-key behavior remains unchanged.

Search uses bound `instr(lower(...), lower(?))` expressions. It matches literal substrings, including `%`, `_`, quotes and SQL-like text. SQLite's built-in `lower` folds ASCII case; non-ASCII text matches literally with its original case. No remote search, locale extension, or network access is used.

## Architecture

| Location | Responsibility |
| --- | --- |
| `src/app/notes/` | Thin Router library/new/edit routes and nested stack |
| `src/features/notes/components/` | Library, editor, note card, category controls, notices, shared feature styles |
| `src/features/notes/hooks/` | Focus refresh, bounded pagination, stale-request protection, counts, editor loading/saving and navigation guard |
| `src/features/notes/services/notesService.js` | Form normalization, mutation results, explicit delete confirmation requirement and view invalidation |
| `src/features/notes/validation/noteInput.js` | Empty/oversized form validation |
| `src/database/repositories/` | Async, parameterized note and category SQL |

`DatabaseProvider` constructs one Notes service on the existing process-owned connection. Service notifications invalidate mounted views; records are always reloaded from SQLite. No separate record store or remote cache is introduced. The dashboard reads the count of **active, nonarchived** notes, refreshes on focus and service mutations, and shows an unavailable state on failure. Other module data remains sample data.

The library fetches 50 records per page and virtualizes cards. Category and archive filters execute in SQLite. The library owns its SafeAreaView and FlatList rather than nesting a virtualized list inside ScreenContainer's ScrollView. The editor reuses ScreenContainer, Android resize keyboard handling, theme tokens and shared UI. No native dependency or configuration change was required.

## Migration 3

Migrations 1 and 2 are unchanged. Migration 3 adds `notes.is_pinned` and `notes.is_archived`, both nonnull integers defaulting to 0 with 0/1 constraints. Existing notes remain active and unpinned. The `(is_archived, is_pinned DESC, updated_at DESC, id ASC)` index supports library filtering/order. Existing timestamps, IDs, category references and rows remain intact.

The original transaction, migration ledger/history checks, foreign-key verification and rollback policy remain in force. Never edit an applied migration, uninstall the app, clear storage, or delete its database to resolve an upgrade error.

## Validation and USB workflow

```powershell
npm.cmd run test:database
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run check:dependencies
npm.cmd run doctor
```

The host tests use real Node SQLite through an async-shaped adapter. They cover CRUD, search, categories, flags, active counts, confirmation safeguards, invalid input, pagination, data preservation, migration idempotency/rollback, process restart persistence and the production gate. Native diagnostics at `/database-diagnostics` additionally exercise the Notes service on an isolated synthetic database.

Use [development-setup.md](development-setup.md) to launch the existing development build over USB. These JavaScript/routes/migration changes need a Metro reload, **not a native rebuild**. A fresh environment still needs the Phase 3 development binary containing expo-sqlite with SQLCipher and expo-secure-store. Rebuild locally after changing native dependencies, plugins or Android configuration; never use an emulator or cloud build.

For manual checks, use a clearly named synthetic note. Create, edit, search, assign/filter a category, pin/unpin, archive/restore, cancel/confirm deletion, and verify the dashboard count. Test Keep editing and Discard with header and hardware Back. Force-stop/reopen to check persistence. Enable airplane mode while retaining USB, relaunch through local Metro, and repeat save/search; restore radio settings afterward. USB Metro is a local development transport, so this does not establish standalone production startup without Metro.

See [phase-4-verification.md](phase-4-verification.md) for executed checks and remaining limits.

## Official references

- [Expo SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/)
- [Expo SDK 58 Router, including usePreventRemove](https://docs.expo.dev/versions/v58.0.0/sdk/router/)
- [React Native FlatList](https://reactnative.dev/docs/flatlist)
- [React Native Alert](https://reactnative.dev/docs/alert)
