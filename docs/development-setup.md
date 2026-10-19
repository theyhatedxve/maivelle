# Maivelle development setup

Use VS Code, Windows PowerShell, and the physical HONOR Android phone over USB. All commands below run from `D:\Maivelle-Local-App\maivelle-local-app`. No emulator, cloud build, or backend is required. Package/tool downloads require internet; USB development does not require phone Wi-Fi.

## 1. Local tools

Expo SDK 58 uses React Native 0.88 and React 19.3. Use Node 24 LTS (verified: 24.20.0), npm, and JDK 17 (verified: Temurin 17.0.20.1). The project uses its generated Gradle 9.4.1 wrapper; do not install global Gradle or legacy `expo-cli`.

Android command-line tools are installed at `C:\Android\Sdk\cmdline-tools\latest\bin`. Android Studio is not needed for this workflow. For a fresh machine, download the Windows **command-line tools only** package from [Android Developers](https://developer.android.com/studio#command-tools), and place `bin`, `lib`, and `source.properties` under `cmdline-tools\latest`.

Set these variables in each new PowerShell terminal (adjust JDK path to your installation):

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot'
$env:ANDROID_HOME = 'C:\Android\Sdk'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"
node --version
java -version
adb version
```

Optionally persist `JAVA_HOME`, `ANDROID_HOME`, and these Path entries through Windows Environment Variables, then restart VS Code. If `ANDROID_SDK_ROOT` is already set, it must point to the same SDK. The existing ignored `android/local.properties` also points to `C:/Android/Sdk`.

Required packages: platform tools, Android API 37 (`platforms;android-37.0` on this SDK), build tools 37.0.0, NDK 27.1.12297006, and CMake 3.31.1. Phase 1 used CMake 3.22.1; Phase 2 needs the newer Ninja toolchain for Router's longer generated native paths. Check available identifiers before installing:

Phase 2 selects CMake 3.31.1 through `plugins/withAndroidBuildSettings.js` to prevent Windows Ninja path-length failures. Run `npx.cmd expo prebuild --platform android --no-install` before the Phase 2 native rebuild so this setting and the Router scheme reach the generated project.

```powershell
sdkmanager.bat --list
# Only when packages are missing:
sdkmanager.bat --sdk_root=C:\Android\Sdk 'platform-tools' 'platforms;android-37.0' 'build-tools;37.0.0' 'ndk;27.1.12297006' 'cmake;3.31.1'
sdkmanager.bat --licenses
```

Run installation and license commands manually: they write to the SDK directory and may require permission. Read and accept licenses yourself. Current Android tools deprecate `sdkmanager` in favor of `android sdk`; the installed `sdkmanager.bat` still works. No system images or emulator packages are needed.

Verify Ninja separately: this SDK's CMake 3.31.1 package also shipped Ninja 1.10.2. Phase 2 uses **Ninja 1.12.1**, downloaded from the [official Ninja release](https://github.com/ninja-build/ninja/releases/tag/v1.12.1), in `C:\Android\Sdk\cmake\3.31.1\bin\ninja.exe`. Its original binary is backed up as `ninja.exe.1.10.2.bak`. On a fresh machine, extract `ninja.exe` from the official `ninja-win.zip`, back up the bundled binary, and copy the new one into that CMake `bin` directory. This is a manual SDK-file update and may require Windows write permission. Confirm with:

```powershell
& C:\Android\Sdk\cmake\3.31.1\bin\ninja.exe --version
# Expected: 1.12.1
```

Windows `LongPathsEnabled` is already enabled on the verified PC. For another PC or a replaced SDK toolchain, follow [Reanimated's official Windows build guidance](https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/) if native path errors occur. SDK updates can replace the Ninja binary, so recheck its version after updating tools.

## 2. Install and check dependencies

```powershell
npm.cmd ci
npm.cmd run check:dependencies
npm.cmd run doctor
npm.cmd run lint
npm.cmd run typecheck
```

Use `npx.cmd expo install <package>` for SDK-compatible dependencies. `typecheck` checks JavaScript through `jsconfig.json`; source files remain `.js`. Install the recommended VS Code ESLint and EditorConfig extensions when prompted.

Phase 2 uses `expo-router/entry` and JavaScript routes in `src/app`. The Phase 1 starter is preserved in `src/App.js` but is no longer the active screen. See [architecture.md](architecture.md) for the five tabs, module routes, and component boundaries. Generated `android/` and `ios/` remain ignored; configure native changes through app config/plugins. Do not run `prebuild --clean` over local native changes without preserving them first.

## 3. Authorize the USB phone

1. On the phone, enable Developer options (usually tap Build number repeatedly), then enable USB debugging. Menu wording varies by MagicOS version.
2. Connect a data-capable USB cable, unlock the phone, and accept its RSA debugging prompt. If necessary, select file transfer USB mode.
3. Run `adb devices -l`. Continue only when the physical phone appears as `device`. `unauthorized` requires approval on the phone; `offline` requires reconnecting. An empty list can indicate cable, USB mode, or a missing OEM ADB driver. Use Windows Device Manager and the manufacturer's driver support if needed.
4. Approve any on-device installation prompt when building. Do not disable unrelated security settings.

## 4. Build, install, and develop over USB

Terminal 1 (leave running):

```powershell
npm.cmd run start:usb
```

Terminal 2 (same environment variables):

```powershell
adb devices -l
adb -d reverse tcp:8081 tcp:8081
npm.cmd run android:device -- --no-bundler
```

Select the connected HONOR phone. For an unambiguous target, pass `--device <serial-from-adb>` to `npx.cmd expo run:android` instead. If no authorized physical device is listed, stop and fix USB access first.

The build generates `android/` only when absent, compiles locally, and installs `android/app/build/outputs/apk/debug/app-debug.apk`. The development build needs Metro to load JavaScript. For a USB-only launch, open the installed development client and enter `http://127.0.0.1:8081`, or run:

```powershell
adb -d shell am start -a android.intent.action.VIEW -d 'exp+maivelle-local-app://?__expo_url=http%3A%2F%2F127.0.0.1%3A8081\&__expo_disable_fab=1\&__expo_disable_auto_launch=1\&__expo_disable_onboarding=1' com.devdb01.maivellelocalapp
adb -d shell pm path com.devdb01.maivellelocalapp
```

`start:usb` requests IPv4-first DNS resolution: on this Windows machine, plain `expo start --localhost` bound to `::1` and USB forwarding failed. If port 8081 is occupied, use `npm.cmd run start:usb -- --port 8083` and substitute 8083 in the reverse command and launch URL. Repeat `adb reverse` after reconnecting the phone. JavaScript edits use Fast Refresh; native dependency/config changes require another build. Press Ctrl+C to stop Metro. Remove forwarding when finished with `adb -d reverse --remove tcp:8081`.

The launch URL uses SDK 58's development-menu flags to hide its floating Tools button, which otherwise overlaps the dashboard Settings button. The literal `\&` escapes each ampersand for the Android shell when running this PowerShell command; do not enter those backslashes into the development client's URL field. If the overlay is already visible, force-stop only Maivelle (`adb -d shell am force-stop com.devdb01.maivellelocalapp`) and rerun the launch command. Shake the phone to open the development menu when needed.

This verifies a development build, not standalone offline startup. A release build with embedded JavaScript and offline behavior testing belongs to a later phase.

## References and verification

- [Expo SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/)
- [Expo local Android compilation](https://docs.expo.dev/guides/local-app-development/)
- [Expo ESLint setup](https://docs.expo.dev/guides/using-eslint/)
- [Android SDK command-line package management](https://developer.android.com/tools/sdkmanager)
- [Android physical-device debugging](https://developer.android.com/studio/run/device)

See [Phase 1 diagnostics](phase-1-diagnostics.md) for the observed results and remaining caveats.

## Phase 3 storage

SQLite and SecureStore require a local native rebuild. The SQLite plugin now compiles SQLCipher support and Android backup is disabled. Follow the prebuild/build commands in [local-database.md](local-database.md), then run `npm.cmd run test:database` for host tests and use the development-only `maivelle:///database-diagnostics` route for native fixtures and restart verification. Normal dashboard and module routes are unchanged.

Storage currently opens only a separate unencrypted development fixture file. Release builds stop at an initialization error before creating any application database until production encryption/key management is implemented. Do not enter real private information into development storage. Installing updates with `adb install -r` preserves app data; do not uninstall or clear storage to fix migrations.
