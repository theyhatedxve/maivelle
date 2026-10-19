# Phase 2 verification

Verified on 18 October 2026 on Windows, with a physical HONOR VKJ-NX9 (Android 17 / API 37) over authorized USB debugging. No emulator, cloud build, backend, or module business logic was used.

## Results

| Check | Result |
| --- | --- |
| Instructions and architecture | Read `AGENTS.md`; no architecture document existed. Added `architecture.md`. |
| Official SDK documentation | Consulted the SDK 58 reference, Router API, entry installation, tabs, stack, anchor settings, and config plugin documentation. Links are in the architecture guide. |
| Router entry | `package.json.main` is `expo-router/entry`; Metro reports `src/app` as the Router root. Root stack uses `unstable_settings.anchor`. |
| Dependency compatibility | `expo install --check`: dependencies up to date. Existing Router/Lucide/native dependencies were already installed before Phase 2 edits; no application dependency was added during this implementation. |
| Project diagnostics | Expo Doctor: **20/20 passed** with the final build plugin configuration. |
| Lint | `npm.cmd run lint`: passed, zero warnings. |
| JavaScript checking | `npm.cmd run typecheck`: passed after final source changes. Sources and config plugin are JavaScript; no `.ts`/`.tsx` application files were introduced. |
| Config plugin | Verified that it preserves unrelated Gradle properties and remains idempotent. Generated Gradle properties select CMake 3.31.1. |
| Android manifest | Verified `maivelle` and development-client schemes, with `android:windowSoftInputMode="adjustResize"`. |
| Native build | **BUILD SUCCESSFUL in 4m 30s**; 483 tasks, 216 executed, 235 from cache, 32 up to date. Built ARM64 for the connected phone with the existing Gradle 9.4.1 wrapper and JDK 17. |
| Installation | Expo CLI installed the debug APK; `adb shell pm path com.devdb01.maivellelocalapp` confirmed the package. |
| USB runtime | Metro served the Router bundle through localhost port 8083 with `adb reverse`; dashboard and all routes rendered on the phone. |
| Navigation checks | **34/34 passed**: direct routes, all five bottom tabs, unknown-route recovery, eight module-card taps, four quick actions, three upcoming-item taps, Finance → Budget, and shared back navigation. |
| Keyboard and header checks | **8/8 passed**: filtering More with the Android keyboard visible, hiding non-matching screens, tapping a result while typing, Android Back to More, clearing the query, and dashboard Settings/back navigation. |
| Branding | Existing branding assets unchanged. |

Local test scripts and machine-readable results are ignored artifacts under `.expo/phase2-*`. Tests used device UI hierarchy snapshots and taps, rather than only checking route filenames. More navigation explicitly dismisses the keyboard. The phone's charging stay-awake setting was saved for testing and restored afterward; temporary Metro and port-8083 forwarding were stopped/removed.

## Windows toolchain fix

The previous CMake 3.22.1 package bundled Ninja 1.10.2, which failed on long generated Reanimated/Gesture Handler C++ paths. Phase 2 selects **CMake 3.31.1** using `plugins/withAndroidBuildSettings.js`. That SDK package also bundled old Ninja, so official **Ninja 1.12.1** was installed into its `bin` directory. The original binary is preserved as `ninja.exe.1.10.2.bak`. Windows long-path support was already enabled; no registry changes were made. The final native build passed with these tools.

See [development-setup.md](development-setup.md) for the fresh-machine SDK/Ninja steps. No SDK, React Native, architecture, or Gradle downgrade was applied. Generated native files were produced by Expo prebuild, not hand-edited.

## Remaining warnings and limits

- npm audit reports **26 affected package entries: 7 moderate and 19 high**. These include transitive dependencies and are not 26 distinct advisories. Proposed fixes included incompatible downgrades to Expo 44.0.6 and React Native 0.72.17; no forced fixes were applied. Raw results are in `.expo/phase2-npm-audit.json`.
- Upstream native tools/libraries emit deprecated Gradle/Android/Kotlin/NDK API warnings, a Kotlin plugin/catalog version notice, and CMake compatibility notices. The successful Gradle 9.4.1 build does not establish Gradle 10 compatibility.
- Gradle falls back from hard links to copying native libraries between the C: cache and D: workspace. This affects build speed and did not prevent compilation.
- Prebuild warns that `expo-system-ui` is absent, so the native `userInterfaceStyle` setting is not enforced through that package. The implemented UI explicitly uses the light theme and dark status-bar icons; no additional native appearance package was added.
- The development launcher logs a caught missing optional `SplashScreenManager` class. The app still loads and all UI checks pass. No custom splash behavior was implemented in Phase 2.
- The installed SDK manager warns that `sdkmanager` is deprecated in favor of Android CLI. Its package commands worked. The existing ESLint 9 tooling remains as configured in Phase 1; lint passes.
- Metro encountered an unreadable cache during initial startup and recovered through a restart/full crawl. The phone also slept during early UI inspection; the temporary stay-awake setting allowed the complete checks to finish.
- Expo's floating development Tools button initially covered the dashboard Settings button. The documented SDK 58 launch flags disable this overlay; Settings then passed its tap test. This is a development-client overlay, not part of the application UI.
- This verifies a debug development client using Metro on one physical phone. Standalone offline startup, persistence, release signing, other devices/font scales, and business logic are outside Phase 2 validation.

## Changed files

| Area | Files / responsibility |
| --- | --- |
| Entry and config | `package.json`, `index.js`, `app.json`, `jsconfig.json`: Router entry, scheme, keyboard mode, build plugin, and JavaScript source checking. |
| Routes | `src/app/`: root stack, five-tab layout, dashboard/More routes, module placeholders, Settings, and unknown-route recovery. |
| Shared UI | `src/components/ui/`: AppButton, AppCard, AppText, EmptyState, IconBadge. |
| Shared layout | `src/components/layout/`: AppHeader, ScreenContainer, ModulePlaceholder. |
| Dashboard | `src/features/dashboard/`: dashboard composition, section/grid/action/item components, More menu, Lucide icon registry, and the single `dashboardData.js` sample-data file. |
| Theme | `src/theme/`: colors, spacing/radii, typography, and exports. |
| Native generation | `plugins/withAndroidBuildSettings.js`: selects the Windows CMake toolchain reproducibly. |
| Documentation | `docs/architecture.md`, this verification report, and updates to `docs/development-setup.md`. |

`src/App.js` remains preserved as the inactive Phase 1 starter. Existing uncommitted work and branding were retained. Phase 3 has not started and requires user approval.
