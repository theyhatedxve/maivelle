# Phase 1 diagnostics

Verified on 18 October 2026, using Windows PowerShell and a physical HONOR device over USB.

| Check | Result |
| --- | --- |
| Repository instructions | Read `AGENTS.md`. User's local-only rule takes precedence over its generic EAS/cloud guidance. |
| Existing user changes | `app.json`, `package.json`, and `package-lock.json` were modified before this task. Config and runtime dependency choices preserved; package files extended for tooling. |
| Runtime dependencies | Expo 58.0.14, expo-dev-client 58.0.14, expo-status-bar 58.0.3, React 19.3.0, React Native 0.88.0. `expo install --check`: dependencies up to date. |
| Node/npm | Node 24.20.0; npm 11.19.0. Compatible with SDK 58's documented Node requirements. |
| JDK | Temurin OpenJDK 17.0.20.1; `java` and `javac` available. |
| Android SDK | `C:\Android\Sdk`; command-line tools, platform tools 37.0.1, API 37 platform (`android-37.0`), build tools 37.0.0, NDK 27.1.12297006, CMake 3.22.1 installed. |
| Build configuration | Generated Gradle 9.4.1 wrapper; compile SDK 37, target SDK 36, minimum SDK 24. Existing ignored `local.properties` resolves SDK. |
| Environment | `JAVA_HOME` already set. `ANDROID_HOME` and SDK Path entries were absent from the session; set temporarily for build commands. Persistent setup remains a manual option. |
| Device | Authorized USB device, manufacturer HONOR, model VKJ-NX9, Android 17 / API 37, ARM64. No emulator used. |
| Expo Doctor | 20/20 checks passed after tooling installation. |
| ESLint | `npm.cmd run lint`: passed, zero warnings. |
| JavaScript checking | `npm.cmd run typecheck`: passed. `jsconfig.json` enables strict `checkJs`; no TypeScript source conversion. |
| Native compilation | `expo run:android --device <connected-serial> --no-bundler`: BUILD SUCCESSFUL in 35s; 313 tasks, 13 executed, 300 up to date. This was an incremental build using existing generated native files/caches. |
| Installation | CLI installed `android/app/build/outputs/apk/debug/app-debug.apk`; `adb shell pm path com.devdb01.maivellelocalapp` confirmed installation. |
| USB runtime smoke test | Metro on localhost port 8083 with IPv4-first DNS plus `adb reverse`: Android bundle completed (688 modules). UI hierarchy contained the original starter text; foreground activity was `.MainActivity`. No matching ReactNativeJS/AndroidRuntime error lines in the sampled log. |

## Changes

Moved the unchanged starter `App.js` into `src/App.js` and updated the entry import. Added Expo flat ESLint config, EditorConfig, VS Code extension recommendations, JavaScript checking, and scripts for diagnostics and physical-device development. Added the development setup guide. Native files were not manually edited. No navigation, backend, cloud service, or application features were added.

## Findings and limits

- Restricted agent execution initially prevented Expo network checks and ADB access to its user directory. Host-access retries succeeded; these were sandbox restrictions, not missing host tools.
- ADB initially reported server/client version mismatch (39 versus 41) and restarted its daemon successfully. Use the SDK's platform-tools ADB consistently if another phone utility starts an older server.
- Plain localhost Metro bound to IPv6 `::1`; USB requests to IPv4 localhost failed with an unexpected end of stream. `start:usb` now uses Node's `--dns-result-order=ipv4first`. The corrected path was tested successfully on port 8083.
- npm audit reported **22 affected package entries: 7 moderate and 15 high**, including transitive Expo/Metro/React Native dependencies. This count includes dependent packages, not 22 distinct advisories. Its proposed fixes included downgrading Expo to 44.0.6 and React Native to 0.72.17; no forced fix or incompatible downgrade was applied. Reassess supported upstream fixes before release. Raw audit output is local and ignored at `.expo/phase1-npm-audit.json`.
- npm warned that the installed ESLint 9.39.5 is no longer supported. It was selected by Expo's installation flow and works with the SDK 58 Expo config; no unverified ESLint major upgrade was applied.
- npm reported an unapproved `unrs-resolver` postinstall script. No blanket script approval was applied; the lint check still passed.
- Gradle reported deprecated Android/Kotlin DSL and legacy variant APIs, plus a Kotlin plugin/catalog mismatch (2.2.10 used versus 2.2.0 declared). Current Gradle 9.4.1 build succeeds; this does not establish Gradle 10 compatibility.
- Android's installed SDK manager warns that `sdkmanager` is deprecated in favor of Android CLI. Listing installed packages succeeded.
- The compiled debug client loads JavaScript from Metro. Standalone offline startup, release signing, a fresh-cache build, and app feature/offline-data testing were not verified in Phase 1.

No unresolved environment blocker prevented compilation, installation, or the USB starter-screen smoke test. Follow [development-setup.md](development-setup.md) to reproduce the workflow and grant any future device permission prompts manually.
