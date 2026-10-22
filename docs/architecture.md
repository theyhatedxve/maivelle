# Maivelle architecture - Phase 13 QA

Maivelle is an Android personal management app built with Expo SDK 58, React Native, TypeScript, and Expo Router. Phase 2 navigation and presentation are preserved. Phase 3 adds a development-only SQLite foundation with migrations and a Notes repository. Production storage is blocked pending encryption/key provisioning. Device app authentication, separately authorized encrypted Vault access and local backup/recovery are implemented; there is no remote authentication or cloud API. Notes, Tasks, Calendar, Medicine with local Android notifications, Time Tracker, Finance and Budget are implemented; see [notes.md](notes.md), [tasks.md](tasks.md), [calendar.md](calendar.md), [medicine.md](medicine.md), [time-tracker.md](time-tracker.md), [finance.md](finance.md) and [budget.md](budget.md). See [local-database.md](local-database.md) for the schema, security boundary, migration rules, and future module targets, and [settings-backup-recovery.md](settings-backup-recovery.md) for Phase 12.

## Source layout

Stage 13A integrates a lazy, fail-closed storage selector in `connection.ts`: an already published encrypted journal routes the real provider to the protected-key owner; legacy development storage stays on its existing path. No automatic provisioning/live conversion occurs. The same selection routes Settings to legacy format-1 or encrypted logical format-2 backup services. Confirmed activation drains consumers and rebuilds providers; first-intent repair is explicit and never regenerates a missing key. See [Stage 13A lifecycle, compatibility and review boundaries](stage-13a-security-handoff.md). Existing production activation/recovery release gates remain.

```text
src/
  app/                     Thin .tsx Expo Router routes; public URLs unchanged
  providers/               AppProviders.tsx: composition and provider order
  components/
    ui/                    Shared typed presentation components
    layout/                Safe areas, keyboard, common headers and containers
  features/
    <module>/
      components/          Module UI and named prop contracts
      hooks/               Screen lifecycle and reusable state logic
      services/            Business rules; SQL remains in repositories
      validation/          Runtime input checks
    dashboard/
      components/          Dashboard, shortcuts, summaries and More menu
      data/                dashboardData.ts: static sample data only
    settings/
      components/          Protected Settings/backup forms
      providers/           SettingsProvider and AppSecurityGate
      model/               Preference defaults and contracts
      services/            Device access, files, backup and recovery services
    vault/providers/       VaultProvider session ownership
    account/               Device-local profile, password login and PIN gate
      components/, hooks/  Fixed branded forms and transient input state
      model/, services/    Validation and protected device-only verifiers
      providers/           Session lifetime and modal access boundary
  database/
    connection.ts          Shared lazy connection/selection composition
    DatabaseProvider.tsx   Repository/service context and replacement lifecycle
    initialize.ts          PRAGMAs and transactional versioned initialization
    transactions.ts        Configured/keyed exclusive writers
    types.ts, rows.ts      Domain and precise SQLite result types
    storage/               Protected-key factory, journal, selection and cutover
    backup/                Bounded archives and validated portable records
    repositories/          Parameterized persistence operations
    migrations/            Published SQL unchanged; incremental versions only
  services/
    security/              Existing verified lazy native crypto adapters
    notifications/         Android local permission/scheduling/reconciliation
  testing/
    database/              Explicit disposable native diagnostics/fixtures
    settings/, vault/      Explicit module security/backup diagnostics
    screens/               Archived diagnostic UI; not registered as app routes
  theme/                   Shared design tokens and theme provider
  App.tsx                  Preserved inactive Phase 1 starter
tests/                     .test.cts host checks and architecture fixtures
scripts/                   .cts Node benchmark
plugins/                   .ts Expo native configuration plugin
tsconfig.json              Strict application/plugin checking; no JavaScript
tsconfig.tools.json        Separate Node test/tooling checking
eslint.config.mts          Native Node TypeScript ESLint configuration
```

Routes compose components and supply screen descriptions. UI components depend on theme tokens and React Native, with no business rules. Layout components own shared safe areas, scrolling, headers, and keyboard handling. The dashboard feature owns all static sample values in `features/dashboard/data/dashboardData.ts`; its icon registry contains presentation metadata only. More reuses the module list for navigation and filters screen names locally; it does not search user records.

## Navigation contract

`package.json.main` remains `expo-router/entry`. Router discovers `.tsx` screens in `src/app`; `index.ts` retains the legacy Router entry import. Strict application checking uses `tsconfig.json`, extending Expo’s base with `allowJs: false`. Node tests/tools use `.cts` and a separate tools config. Typed routes remain disabled; no navigation refactor, Babel override or dependency upgrade is introduced. See [TypeScript migration and maintenance](typescript-migration.md).

The root stack anchors deep links at `(tabs)` using SDK 58's `unstable_settings.anchor`. Tabs own `/`, `/tasks`, `/calendar`, `/finance`, and `/more`. Module screens and feature editor stacks sit alongside the tab navigator. Shared back headers remain in root screens. Module shortcuts open their library or preview; live Tasks dashboard items open the task editor. The Finance tab opens its dashboard; `/financial/*` holds account/transaction/transfer editors, history, categories and reports without colliding with that tab. Finance retains the link to Budget Divider; More exposes every module and Settings. Header settings opens `/settings`. Unknown routes show a Home recovery action. Android system Back and the shared back button use Router history; a direct-open screen falls back to Home if there is no history.

The root also owns `/welcome`, `/sign-up` and `/sign-in`. Home directs an
installation without a local profile into onboarding. `LocalAccountProvider`
and `LocalAccountGate` wrap the navigator inside the existing providers. The
navigator remains mounted, covered by a native PIN/login modal while locked.
This additional local access layer never authorizes the Vault key or replaces
the optional Android device-auth lock. See [local profile access](local-profile-access.md).

The lavender Home dashboard shows live Vault item count, active Notes count,
incomplete Tasks and this month's PHP income. Greeting/date use the device clock;
Today’s Focus combines Calendar events and incomplete task deadlines; Recent Notes
reads three bounded previews in modification order. Quick actions open creation
and local backup forms. All eight modules remain reachable through More; its
navigation metadata remains in `features/dashboard/data/dashboardData.ts`.
The custom bottom bar presents Home, Plan, Notes, Vault and More; Plan targets
the existing Calendar tab, and Notes/Vault open their existing root stacks.
Underlying Tasks/Finance tab routes remain valid and Vault authorization is
unchanged. See [dashboard redesign](dashboard-redesign.md).

## UI conventions

- Primary `#6D42C7`, accent `#8B5CF6`, soft lavender backgrounds and white cards.
- System fonts; centralized type, spacing, and radius tokens. Lucide icons with visible labels.
- Flexible wrapping grids, flexible text, and a centered maximum content width. No fixed device dimensions. Content scrolls on compact screens and at larger font scales.
- Root status bar uses dark icons over the light safe area. `ScreenContainer` handles top/side safe areas; the tab navigator handles bottom insets. Root stack screens also apply their bottom inset.
- Android uses `softwareKeyboardLayoutMode: resize`. Scroll views keep taps on controls working with the keyboard open; tabs hide while typing. iOS padding fallback remains in the shared keyboard container.
- Pressables expose button roles, labels, feedback, and minimum touch targets. Font scaling remains enabled. Decorative icons do not replace labels.

## Local development and rebuilds

Use the Windows USB workflow in [development-setup.md](development-setup.md). Phase 2 requires a local native rebuild because Router/navigation/SVG/safe-area native modules must be linked and the new URL scheme and keyboard config must reach the Android manifest:

```powershell
$env:ANDROID_HOME = 'C:\Android\Sdk'
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:Path"
npx.cmd expo prebuild --platform android --no-install
npm.cmd run start:usb
# In a second configured terminal, with an authorized physical phone:
adb devices -l
adb -d reverse tcp:8081 tcp:8081
npm.cmd run android:device -- --no-bundler
```

Prebuild generates the ignored Android project from config; Expo may regenerate existing native files. Do not hand-edit native files. `maivelle://notes` and equivalent route URLs work after the rebuild. Use the development guide's localhost launch command, including the SDK 58 flags that hide the development client's floating Tools overlay.

`plugins/withAndroidBuildSettings.ts` writes `android.cmakeVersion=3.31.1` through Expo's `withGradleProperties`. SDK 58's root Gradle plugin applies this version to all native subprojects. This CMake version is paired locally with official Ninja 1.12.1; the SDK package's bundled Ninja 1.10.2 failed on generated Reanimated/Gesture Handler paths on this Windows workspace. The newer toolchain supports long paths. The config survives prebuild without editing generated Gradle files and adds no application dependency. Windows long-path support is already enabled on the verified PC. The SDK Ninja update and its backup are documented in the development guide; recheck Ninja after SDK updates.

Subsequent `.ts`/`.tsx`, sample data, token, and route edits need Metro reload/Fast Refresh; entry changes may require restarting Metro with `--clear`. Native dependency changes and app config/plugin changes need prebuild plus another native build. The development build still needs Metro; standalone offline behavior is not established by this phase.

## Official references

- [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/)
- [Router installation and entry point](https://docs.expo.dev/router/installation/)
- [SDK 58 Router API](https://docs.expo.dev/versions/v58.0.0/sdk/router/)
- [JavaScript tabs](https://docs.expo.dev/router/advanced/tabs/)
- [Root stack](https://docs.expo.dev/router/advanced/stack/)
- [Router anchors and settings](https://docs.expo.dev/router/advanced/router-settings/)
- [Expo config plugins](https://docs.expo.dev/config-plugins/plugins/)
- [Reanimated Windows build troubleshooting](https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/)

The root layout now gates the same navigator behind `src/database/DatabaseProvider.tsx`. `src/database/connection.ts` owns the connection, `initialize.ts` configures it, `migrations/` owns versioned schema changes, and repositories own SQL. `tests/database/` exercises the real host SQLite engine; `/database-diagnostics` is a development-only native verification route with no dashboard shortcut. Vault is implemented for fictional development credentials; Notes, Tasks, Calendar, Medicine, Time Tracker, Finance and Budget retain their existing screens.

Phase 4 adds the complete development Notes workflow described in [notes.md](notes.md). Notes routes are thin; its service owns mutations and validation, repositories own SQL, and hooks own view refresh. Phase 5 adds the local Task Manager described in [tasks.md](tasks.md), including migration 4, categories, checklist and live summaries. Phase 6 adds the offline Calendar with bounded recurrence and task projection; see [calendar.md](calendar.md). Phase 7 adds schedule revisions, immutable dose logs and a bounded local notification queue; see [medicine.md](medicine.md). Phase 8 adds migration 7, the offline Time Tracker and segment-derived analytics; see [time-tracker.md](time-tracker.md). Phase 9 adds migration 8, the integer-minor-unit Finance ledger and reports; see [finance.md](finance.md). Production storage remains gated pending encryption. Phase 10 adds migration 9, funding snapshots, exact allocations and expense linking; see [budget.md](budget.md). Budget reads the shared Finance ledger within its transaction; Finance services do not depend on Budget. Phase 11 adds the development Password Vault described in [vault.md](vault.md), using authenticated encrypted payloads and the verified native background scrypt dispatcher. The production database gate remains.


Phase 11 adds migration 10 (vault_metadata, vault_items, vault_settings), a ciphertext-only Vault repository, a pure key/session service and a root VaultProvider. Public provider state contains only status and generation flags. Vault layout waits for Android screen protection before mounting forms, and locking unmounts secret screens. The dashboard shows lock status without credential metadata. See [vault.md](vault.md) for key lifecycle, backups and security limits.

Phase 12 adds the settings repository over existing `app_settings` versioned keys, Settings/Theme/AppSecurity providers, and a portable whole-app backup service. No new main-database migration is needed. Shared presentation components consume palette hooks for Light/Dark/System; existing module business logic is preserved. The app-access modal keeps Expo Router's root navigator mounted, hides covered content and invalidates Vault authorization independently of device authentication. Notification preferences reuse the existing Medicine reconciler.

`src/features/settings` owns bounded snapshot encryption, staging validation and Settings UI; `database/storage/maintenance.ts`, `database/storage/cutover.ts` and `database/storage/storageControl.ts` own retirement, connection reopening and the separate nonsensitive pointer journal. Whole-app recovery preserves the old generation and rejects unknown schema/format policies; it never merges or resets live records. See [Settings backup/recovery](settings-backup-recovery.md) and [Phase 12 verification](phase-12-verification.md). The production encryption gate and dependency security baseline remain in place.

Phase 13 adds `database/transactions.ts`: initialized native handles use separately owned short-lived writers with FK enforcement verified before BEGIN, preserving existing repository interfaces and cutover draining. This corrects the installed Expo exclusive helper's fresh-connection PRAGMA gap. Notes library reads use bounded previews while full-content reads/search remain intact; dashboard count observation ignores stale requests. Calendar sorts civil keys directly. QA lives in `tests/integration`, `testing/database/phase13Scenarios.ts`, the explicit development-only `/integration-diagnostics` route and `scripts/phase13-benchmark.cts`. No main schema, native crypto or persistent cache change was introduced. The only dependency change is explicitly approved SDK 58 SystemUI 58.0.6 with automatic appearance/config plugin; it requires a replacement development build. See [Phase 13 results](phase-13-test-results.md) and [release gates](release-readiness.md).
