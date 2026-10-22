# TypeScript migration and maintenance — 22 October 2026

The existing application, routes, diagnostic fixtures, Node test harness, benchmark,
config plugin and ESLint configuration were migrated to TypeScript. TypeScript and
React type packages were already installed. No package versions or lockfile entries
changed; no native implementation, branding asset, database, Vault key, schema SQL
or migration history was replaced. Historical phase reports describe the paths and
JavaScript tooling that existed at their checkpoints; this guide and architecture
describe the current source layout. This work does not begin another feature phase.

## File conventions

- `.tsx`: components, screens and providers containing JSX.
- `.ts`: services, hooks, validation, repositories, migrations, tokens and type models.
- `.cts`: the CommonJS Node test/benchmark harness. Node 24 strips types directly;
  these files exercise the actual `.ts` implementation, not emitted copies or mocks
  of the application. Subprocess persistence/DST fixtures also import `.ts` sources.
- `.mts`: ESLint's ESM TypeScript configuration. The lint command uses the installed
  ESLint native-Node-TypeScript config flag; it does not install a loader.

`tsconfig.json` extends Expo's base with `strict: true`, `allowJs: false` and no emit.
Application, diagnostics and the config plugin are strictly checked. Relative
imports generally include the actual `.ts`/`.tsx` extension so both Metro and native Node test
execution resolve the same implementation; `allowImportingTsExtensions` permits it.
**Platform-paired modules are an exception:** app imports of `vaultKdf` stay
extensionless so Metro selects `vaultKdf.native.ts` on Android. Only host tests
explicitly import `vaultKdf.ts`. Forcing `.ts` on the app import selects the
Node-only reference and is a regression; the new architecture test rejects it.
Use `import type` for new type-only imports. Existing inline `import(...).Type` type
queries are erased and do not load native modules.

`tsconfig.tools.json` separately checks Node scripts, ESLint configuration and tests.
It uses Node types and relaxed strictness for the dynamic fault-injection harness,
which intentionally supplies invalid inputs and mutates injected adapters. This
does **not** relax strict application checking. Existing `any` types at validated
JSON/native boundaries were not represented as complete runtime schema validation;
TypeScript alone is not an input validator or security guarantee.

## Organization and ownership

| Folder | Responsibility |
| --- | --- |
| `src/app` | Expo Router files only; existing route/group names preserved |
| `src/providers/AppProviders.tsx` | App composition, preserving storage → settings/theme → Vault → app lock → reminder order |
| `src/features/<module>/components` | Module presentation and named prop contracts |
| `src/features/<module>/hooks` | Reusable screen lifecycle/state logic |
| `src/features/<module>/services` | Business rules and injected module interfaces |
| `src/features/<module>/validation` | Runtime validation of untrusted form/data values |
| `src/features/dashboard/data` | Dedicated static dashboard sample data |
| `src/features/settings/providers`, `model`, `services` | Settings/app-lock contexts, preferences and platform/backup services |
| `src/features/vault/providers` | Vault session ownership; services remain in the existing Vault services folder |
| `src/database` | Connection/provider composition, initialization, transactions, errors and shared types |
| `src/database/storage` | Protected-key factory, selection, generation owner/journal and cutover maintenance |
| `src/database/backup` | Bounded portable archive framing and validated logical record import/export |
| `src/database/repositories` | Parameterized SQL; UI components contain no new SQL |
| `src/database/migrations` | Published migration history; add new versions instead of rewriting old SQL |
| `src/database/rows.ts` | Schema-specific SQLite result interfaces, including nullable columns |
| `src/testing/database`, `settings`, `vault` | Explicit development-only fictional native diagnostics, separate from production services |
| `src/components`, `src/theme` | Shared UI/layout and design tokens |
| `tests`, `scripts`, `plugins` | Host checks, benchmark and reproducible Expo build configuration |

Feature folders retain their established names, including `timeTracker`; renaming
routes or public module APIs is unnecessary for this cleanup. Providers stay outside
`src/app` so Router does not discover them as screens. Do not introduce cross-feature
SQL or a second persistent record store. Screens compose features; repositories
remain the persistence boundary. Export named props and domain/result types where
they improve reuse instead of duplicating large anonymous types.

## Readability and safe edits

The migration converts JSDoc contracts to native types, gives 69 existing component
prop contracts names, and formats dense JSX and one-line functions into readable
blocks. Security/lifecycle explanations remain comments. `.prettierrc.json` sets
two-space indentation, single quotes, a 100-column target and LF; the existing
VS Code Prettier extension performed formatting without an npm dependency install.
Use Format Document in VS Code. Generated native/build/cache files are excluded.

Use precise SQLite result generics and update `rows.ts` when an approved new
migration changes a row shape. SQL values remain parameterized. Enum unions such
as timer type/status reflect existing SQLite CHECK constraints. Validate decoded
JSON and user input at runtime before relying on a type assertion.

The lazy `require` boundary in verified native security adapters and diagnostics is
intentional. ESLint permits it only in the listed security/native-loading files;
do not replace it with eager startup imports merely to satisfy a style rule.
The SDK's Metro rejected `declare` class fields during validation; the error class
uses a normal typed readonly field without a Babel override.

Physical validation caught the platform-paired import regression before completion.
The host-reference guard refused to execute on Android, preserving the fail-closed
boundary. The two caller imports were restored to their original platform-aware
form; the native KDF implementation, dispatcher, work factors and stored keys were
not replaced. A test-fixture cleanup error initially hid this cause behind a
missing recovery-file error; cleanup now checks existence only for its exact
disposable names. Failed attempts remain recorded separately from successful runs.

## Verification commands

```powershell
npm.cmd run typecheck       # strict app/plugin + separate Node tooling checks
npm.cmd run lint            # zero warnings
npm.cmd test                # all database, Vault, settings and integration tests
npm.cmd run check:dependencies
npm.cmd run doctor
node node_modules/expo/bin/cli config --type introspect
node node_modules/expo/bin/cli export --platform android --source-maps --output-dir .expo/typescript-check --max-workers 2
npm.cmd run verify:android-export -- .expo/typescript-check
```

Config introspection evaluates the `.ts` plugin without generating native files.
The export verifier also checks the actual bundled graph for the native KDF and
rejects inclusion of its Node-only reference; a compiler pass alone cannot prove
Metro platform selection.
Application identity, SQLCipher configuration, screenshot protection, fontScale
manifest handling and native KDF work factors remain unchanged. No native rebuild
is needed solely for the language/file organization change. Do not uninstall or
clear data to test this migration. Close/reopen the development runtime after the
large rename; do not rely on retained Fast Refresh closures for security testing.

The new architectural regressions preserve existing Router paths and hash every
previously published migration's name/SQL. New migration versions and new routes
may be appended; updating a snapshot to conceal a rewritten migration is not valid.

## Results and limits

Current executed results and physical-device checks are recorded in the validation
section below. `.expo/typescript-before` preserves the exact pre-migration source
workspace, including uncommitted work; `.expo/typescript-mapping.json` records the
renames. These ignored local files are review/rollback evidence, not shipped data.

The existing 26 npm advisories and Stage 13A production-encryption/recovery release
gates remain. No force fix, package override, security fallback or live conversion
was introduced. A TypeScript compiler pass does not establish production security.

Official references consulted: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
and [Expo's existing-project TypeScript migration guide](https://docs.expo.dev/guides/typescript/).

## Executed validation

**TypeScript migration: PASS. Overall production release: still NOT READY.**

| Check | Result and local evidence |
| --- | --- |
| Source migration/structure | 306 existing JS/JSX/CommonJS/config files converted. App source now contains **157 `.ts` + 128 `.tsx` files**, including new row models and app composition; no JS/JSX remains in source, tests, scripts or plugins. Vendor/generated/cache files are outside this migration. |
| Strict app/plugin and Node tooling checks | `npm.cmd run typecheck` passed, including separate tooling checks. No application `ts-nocheck` or relaxed strictness was added. |
| Lint | Zero errors/warnings. Expo's TS preset now also covers `.cts`/`.mts`; Node harness and verified lazy security loaders have scoped CommonJS allowances. |
| Automated suites | **214 passed, zero failed/skipped**. `.expo/typescript-tests-final.txt`. New checks protect published SQL, Router inventory, provider order and platform-aware KDF imports. Initial five subprocess/DST failures were old `.js` strings inside child-process scripts; those references were corrected and the full suite rerun. |
| Expo SDK | Installed versions preserved; compatibility reports up to date; Doctor **20/20 passed**. Config/public and config/introspection passed with the `.ts` plugin. CMake, fontScale, app identity, SQLCipher and backup settings remain unchanged. |
| Android production JavaScript export | Passed, **4,960,020 bytes**, 3,561 mapped sources. SHA-256 `d861007a59e546c47ea977f162186ff2b1de4519c43639a6e524051b559e72b7`. `.expo/typescript-accepted-android`, `typescript-build-evidence.json`. `npm.cmd run verify:android-export` confirms native KDF included/Node reference excluded. Earlier exports before the platform-import correction are superseded. No release APK was made. |
| Physical module suites | **9/9 passed**: Notes/database, Tasks, Calendar, Medicine, Time Tracker, Finance, Budget, Vault (**27 checks**) and Settings (**18 checks**). First seven: `.expo/typescript-final-native-*.txt`; Vault/Settings after resolver correction/cold runtime: `.expo/typescript-tail-{vault,settings}.txt`. Failed Vault attempts and premature cold-start route observation are retained, not counted as passes. |
| Physical native crypto | Load **7 ms**, random **2 ms**, AES gate **224 ms** passed; authenticated decrypt, wrong key, ciphertext/tag/AAD tamper refusal included. Full-cost native background KDF gate **3879 ms**, known answer and positive JS-timer responsiveness assertion passed. `.expo/typescript-crypto-*.txt`. Exact per-KDF timer count was not captured; screen heartbeat is a different counter. |
| Physical SQLCipher | **8/8 passed**: keyed creation/reopen/writer, FK, schema 1→10 preservation, wrong/missing keys, missing/empty file refusal and unchanged records after rejected opens. `.expo/typescript-cipher-native.txt`. Injected missing-key/file branches are not hardware Keystore invalidation. |
| Physical encrypted integration | **10 assertions plus cleanup passed**, `.expo/typescript-encryption-native.txt`: first intent recovery, selected owner, bounded format-2 read-back, wrong passphrase, Vault-verified preview, cancellation, exact eight-module/Vault recovery, reminder recording-adapter reconciliation and owner reopening. Private callbacks replace the human picker; this is not a new full SAF/authentication UI run or live restore. |
| Physical navigation and completion state | Home and all nine module/Settings routes passed; cold Home and locked Vault entry verified. `.expo/typescript-ui-final.json`. Final font **0.85**, airplane **Off**, Wi-Fi **On**. Zero encrypted-generation files/probe journals and **no production journal** after cleanup. |
| Preservation audit | All ten migration SQL bodies match their original runtime values. Thirty native implementation/build/config fingerprints unchanged. `package-lock.json` remains SHA-256 `8c308328720e1044d21bbd61e8211d40bab1bcbe710bba9d82b79724d4a09960`; dependencies/devDependencies are unchanged. `.expo/typescript-runtime-audit.json`, `typescript-native-fingerprints.json`. Branding assets and real Vault keys/data were not replaced. |

The runtime AST comparison ignores import relocation, type erasure and UI text
spacing. The reviewed exceptions are root provider extraction, the typed error
field, explicit missing-fixture handling and cleanup that preserves the original
diagnostic failure. It is scoped evidence, not a formal equivalence/security proof.

Not newly repeated: live font resizing/TalkBack, human biometric prompts/full
encrypted-mode file-picker confirmation, real-data conversion, power-loss or real
Keystore-invalidated recovery, actual phone ENOSPC and standalone release/offline
startup. Native suites used fictional disposable records; no real credentials
were entered. Existing Phase 13 security, recovery, dependency and release
limitations remain documented. No native rebuild was needed or performed.
