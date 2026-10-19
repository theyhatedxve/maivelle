# Maivelle architecture - Phase 6

Maivelle is an Android personal management app built with Expo SDK 58, React Native, JavaScript, and Expo Router. Phase 2 navigation and presentation are preserved. Phase 3 adds a development-only SQLite foundation with migrations and a Notes repository. Production storage is blocked pending encryption/key provisioning. No network access, authentication or notifications are implemented. Notes, Tasks and Calendar are implemented; see [notes.md](notes.md), [tasks.md](tasks.md) and [calendar.md](calendar.md). See [local-database.md](local-database.md) for the schema, security boundary, migration rules, and future module targets.

## Source layout

```text
src/
  app/
    _layout.js          Root stack, status bar, safe-area provider
    (tabs)/
      _layout.js        Home, Tasks, Calendar, Finance, More
      index.js          Home dashboard
      tasks.js
      calendar.js
      finance.js
      more.js
    notes/              Library, new, [id] editor, nested stack
    task/               New, [id] editor, category manager, nested stack
    event/              New, [id] occurrence/series editor, parent series list
    medicine.js
    timer.js
    vault.js
    budget.js
    settings.js
    +not-found.js
  components/
    ui/                 AppButton, AppCard, AppText, EmptyState, IconBadge
    layout/             AppHeader, ScreenContainer, ModulePlaceholder
  features/
    notes/              Components, hooks, service, validation (see notes.md)
    tasks/              Components, hooks, service, dates/validation (see tasks.md)
    calendar/           Views, event editor, recurrence, dates, validation
    dashboard/          HomeDashboard, ModuleGrid, QuickActions,
                        UpcomingItems, DashboardSection, MoreMenu,
                        moduleIcons, dashboardData
  theme/                colors, spacing/radii, typography
  database/             Owned connection, initialization, provider, migrations,
                        Notes repository, errors/types, native test fixtures
  App.js                Preserved Phase 1 starter; no longer the active entry
plugins/
  withAndroidBuildSettings.js  Reproducible Windows CMake version setting
```

Routes compose components and supply screen descriptions. UI components depend on theme tokens and React Native, with no business rules. Layout components own shared safe areas, scrolling, headers, and keyboard handling. The dashboard feature owns all static sample values in `dashboardData.js`; its icon registry contains presentation metadata only. More reuses the module list for navigation and filters screen names locally; it does not search user records.

## Navigation contract

`package.json.main` is `expo-router/entry`. Router discovers JavaScript routes in `src/app`; the legacy `index.js` also imports Router's entry for tooling compatibility. No Babel overrides, typed routes, or TypeScript application files are introduced. Existing JavaScript checks use JSDoc and `jsconfig.json`.

The root stack anchors deep links at `(tabs)` using SDK 58's `unstable_settings.anchor`. Tabs own `/`, `/tasks`, `/calendar`, `/finance`, and `/more`. Module screens and the Notes/Task editor stacks sit alongside the tab navigator. Shared back headers remain in root screens. Module shortcuts open their library or preview; live Tasks dashboard items open the task editor. Finance links to Budget; More exposes every module and Settings. Header settings opens `/settings`. Unknown routes show a Home recovery action. Android system Back and the shared back button use Router history; a direct-open screen falls back to Home if there is no history.

Eight dashboard modules: Tasks, Calendar, Finance, Notes, Medicine, Timer, Vault, Budget. Settings is an additional utility screen. The greeting, sample date, other module values, quick actions, and upcoming items are centralized in `dashboardData.js`. Calendar, Notes and Tasks cards read live SQLite summaries; today's incomplete Tasks are shown on the dashboard. Placeholder buttons navigate; they do not create records, start timers, or provide encryption.

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

`plugins/withAndroidBuildSettings.js` writes `android.cmakeVersion=3.31.1` through Expo's `withGradleProperties`. SDK 58's root Gradle plugin applies this version to all native subprojects. This CMake version is paired locally with official Ninja 1.12.1; the SDK package's bundled Ninja 1.10.2 failed on generated Reanimated/Gesture Handler paths on this Windows workspace. The newer toolchain supports long paths. The config survives prebuild without editing generated Gradle files and adds no application dependency. Windows long-path support is already enabled on the verified PC. The SDK Ninja update and its backup are documented in the development guide; recheck Ninja after SDK updates.

Subsequent `.js`/JSX, sample data, token, and route edits need Metro reload/Fast Refresh; entry changes may require restarting Metro with `--clear`. Native dependency changes and app config/plugin changes need prebuild plus another native build. The development build still needs Metro; standalone offline behavior is not established by this phase.

## Official references

- [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/)
- [Router installation and entry point](https://docs.expo.dev/router/installation/)
- [SDK 58 Router API](https://docs.expo.dev/versions/v58.0.0/sdk/router/)
- [JavaScript tabs](https://docs.expo.dev/router/advanced/tabs/)
- [Root stack](https://docs.expo.dev/router/advanced/stack/)
- [Router anchors and settings](https://docs.expo.dev/router/advanced/router-settings/)
- [Expo config plugins](https://docs.expo.dev/config-plugins/plugins/)
- [Reanimated Windows build troubleshooting](https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/)

The root layout now gates the same navigator behind `src/database/DatabaseProvider.js`. `src/database/connection.js` owns the connection, `initialize.js` configures it, `migrations/` owns versioned schema changes, and `repositories/notesRepository.js` owns Notes SQL. `tests/database/` exercises the real host SQLite engine; `/database-diagnostics` is a development-only native verification route with no dashboard shortcut. The remaining five module screens are placeholders; Notes, Tasks and Calendar have working libraries and editors.

Phase 4 adds the complete development Notes workflow described in [notes.md](notes.md). Notes routes are thin; its service owns mutations and validation, repositories own SQL, and hooks own view refresh. Dashboard Notes and Tasks counts are live; the remaining five modules remain sample previews. Phase 5 adds the local Task Manager described in [tasks.md](tasks.md), including migration 4, categories, checklist and live summaries. Phase 6 adds the offline Calendar with bounded recurrence and task projection; see [calendar.md](calendar.md). Phase 7 requires user approval.
