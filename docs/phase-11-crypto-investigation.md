# Phase 11 crypto isolation — 20 October 2026

The original "native loading" diagnosis was provisional. Isolated HONOR tests establish that Expo Crypto loads and its Android RNG/AES APIs work. A scheduling defect in the combined probe was identified and removed: full-cost Noble JavaScript scrypt ran on the Hermes thread, despite its `Async` name. This report records the isolation and fix before credential storage. The subsequent implementation is documented in [Vault verification](phase-11-vault-verification.md); Phase 12 has not started.

## Root cause and evidence

The entry point was the development `/vault-security-check` route calling `src/services/security/vaultCryptoGate.js`, which lazily required `expo-crypto` and then ran randomness, Noble scrypt and AES consecutively. The last visible loading label was not a stack trace. React progress updates cannot reliably paint while JavaScript monopolizes the event loop.

Installed `@noble/hashes` 2.2.0 `utils.js` defines `nextTick` as an immediately resolved async function. `scryptAsync` calls `asyncLoop`, which awaits that function. This yields microtasks, without yielding to timers/input/rendering or moving CPU work to a worker. `asyncTick: 10` therefore did not make a 128 MiB full-cost KDF safe on the application's JavaScript thread. The library documents this scheduling behavior; the integration incorrectly assumed otherwise.

On HONOR, a **bounded** public `N=1024,r=1,p=1,asyncTick=0` reproduction took **103 ms** and a previously queued zero-delay timer did **not** run during derivation. The host regression reproduces the same semantics. Full-cost JavaScript scrypt was not rerun on the phone's UI runtime. Isolated Expo Crypto loading completed in **13 ms**, randomness in **6 ms**, and initial AES checks in **97 ms** on the already installed APK, before changing native code. These results rule out a reproducible native-loader/linking failure in this reproduction.

The verified defect is **JavaScript event-loop starvation**, not a demonstrated Android main-thread deadlock. No historical native stack was available, so an additional transient cause in the original frozen process cannot be conclusively excluded. No file named `phase11-android-log.txt` was found in this workspace. The prior report's missing exception/stack evidence was preserved rather than invented.

## Fix

- Added an Android local Expo module at `modules/maivelle-crypto`, automatically linked by the installed SDK 58 tooling. Its fixed-policy scrypt uses **Bouncy Castle `bcprov-jdk15to18:1.86`**, directly through `SCrypt.generate`; it does not register/replace Android's JCA provider.
- `AsyncFunction` dispatches computation with `withContext(Dispatchers.Default)`, explicitly checks it is off Android's main thread, and serializes full-cost derivations with a mutex. Algorithm/work factors remain **N=131072,r=8,p=1,32-byte output**, with 32-byte salts. No caller-controlled costs or low-cost credential-key API exist. The small RFC test accepts only its fixed public fixture.
- `vaultKdf.native.js` validates inputs and fails if the native module is missing. Metro selects it on Android. `vaultKdf.js` remains a host reference for independent cross-checks and explicitly refuses app runtimes. There is no JavaScript KDF fallback in the app.
- Shared validation/policy live in `vaultKdfPolicy.js`. Owned valid native input copies are cleared after derivation. This does not guarantee zeroization of every bridge, VM or provider allocation. The algorithm's main working state is approximately 128 MiB; the host `maxmem` option is not an Android process-RSS limit.
- Diagnostic controls separately trigger loading, randomness, AES, native KDF and a bounded scheduling reproduction. There are no crypto startup effects or URL autorun. Progress/timing/error labels contain no key, password, salt or payload values. Normal Home startup and the Vault placeholder do not invoke these checks.

JavaScript/JSX application code is preserved. Kotlin/Gradle files are confined to the required local Android adapter; generated root `android/` files were not edited by hand. No npm dependency versions or app.json configuration changed in this investigation.

## Physical Android verification

Local rebuild completed **BUILD SUCCESSFUL** in **45 seconds**, 524 actionable tasks, and replacement installation succeeded on HONOR `AFAM026324010734`. No uninstall, storage clear, database reset, emulator or cloud build was used. USB Metro was selected explicitly after the CLI opened its default 8081 network URL. Existing SQLCipher configuration, production `ENCRYPTION_REQUIRED` gate and migrations 1–9 remain intact.

Verified on the rebuilt binary:

| Check | Result |
| --- | --- |
| Normal Home startup | Passed |
| Native module import, no cryptographic operation | Passed |
| Native secure random API | Passed; availability/source check, not a statistical proof |
| Native RFC 7914 scrypt vector | Passed |
| Full-cost native scrypt vs independent Node/OpenSSL expected output | Passed, **3722 ms** |
| JavaScript event loop during native derivation | **223 timer ticks**; responsive |
| Native invalid password/salt sizes | Rejected |
| AES-256-GCM known-answer vector and decryption | Passed |
| Wrong AES key | Rejected |
| Modified ciphertext, authentication tag and associated data | Each rejected |
| Sampled nonce uniqueness | Passed; not a collision-freedom proof |
| Expanded AES suite duration | **236 ms** |
| Expected diagnostic failure, error display and return to Home | Passed |
| Existing fictional Finance total after replacement installation | Preserved, PHP 2,580.00 |

All **seven native regression suites passed** on this APK: database/Notes, Tasks, Calendar, Medicine, Time Tracker, Finance and Budget. They use separate synthetic fixtures. Host database tests passed **137/137**; host crypto tests passed **5/5**, including scheduling reproduction and rejecting the host reference in an app runtime. Lint passed with zero warnings, strict JavaScript type checking passed, Expo dependency checks reported up to date, Doctor passed **20/20**, and `git diff --check` passed. The deliberate diagnostic failure was displayed and normal navigation returned to Home successfully.

Only public/fictional fixtures were used; nothing was written to the application database or SecureStore. Timing values are measured observations from the explicit development run, not latency guarantees. Public diagnostic labels were observed through Metro; a filtered Android logcat query returned no matching entries and is not presented as captured crypto evidence.

Local ignored artifacts: `.expo/phase11-android-rebuild.txt`, `.expo/phase11-crypto-isolation-results.json` and `.expo/phase11-fixed-native-regression-results.json`. Initial Kotlin coroutine-overload compilation errors were fixed before the successful build. Upstream Gradle/Kotlin deprecation/version notices remain.

## Source files changed in this investigation

| Files | Purpose |
| --- | --- |
| `src/app/vault-security-check.js` | Explicit development checks, heartbeat, status/error recovery; no autorun |
| `src/services/security/vaultCryptoGate.js` | Separate AES/KDF suites, wrong-key/tag rejection, timings and responsiveness |
| `src/services/security/vaultKdf.js` | Host-only reference with app-runtime refusal |
| `src/services/security/vaultKdf.native.js` | Native background KDF adapter with no fallback |
| `src/services/security/vaultKdfPolicy.js` | Shared fixed policy and input validation |
| `modules/maivelle-crypto/{package.json,expo-module.config.json,.gitignore}` | Local module registration and generated-artifact exclusions |
| `modules/maivelle-crypto/android/build.gradle` | Pinned Bouncy Castle dependency and Expo library configuration |
| `modules/maivelle-crypto/android/src/main/AndroidManifest.xml` | Minimal library manifest; no permissions |
| `modules/maivelle-crypto/android/src/main/java/expo/modules/maivellecrypto/MaivelleCryptoModule.kt` | Background scrypt, bounded policy, serialization and public RFC fixture |
| `tests/vault/crypto-gate.test.cjs` | Added scheduler and no-app-fallback regressions |
| `docs/phase-11-verification.md`, `docs/vault-security-architecture.md`, this report | Corrected current status while retaining historical observations |

## Reproduce locally

1. Connect/unlock the physical HONOR and accept USB debugging if Android prompts. Never uninstall or clear storage to address a failed installation.
2. With JDK 17 and Android SDK command-line tools configured, run `npx.cmd expo run:android --device AFAM026324010734 --no-bundler` after native adapter/dependency changes. This local module is linked from `modules/`; existing generated Android projects discover it without hand edits. Fresh projects need the normal Expo Android prebuild first.
3. Start `npm.cmd run start:usb -- --port 8086`, then `adb -s AFAM026324010734 reverse tcp:8086 tcp:8086`. Use the documented development-client localhost URL with the SDK 58 overlay flags. Wait for Home before deep-linking.
4. Open `maivelle:///vault-security-check` explicitly. Trigger each check separately; the native KDF requires the rebuilt binary. The bounded scheduling check intentionally demonstrates the old library behavior with a small public fixture, never with full-cost UI-thread work.
5. Run `npm.cmd run test:vault`, `npm.cmd run test:database`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run check:dependencies`, and `npm.cmd run doctor`.

The delay/frame yield before a diagnostic is for painting its status, not a timeout or fix for CPU blocking. The fix is moving full-cost computation to a native background dispatcher.

## Remaining security boundary

This resolves the reproduced crypto execution blocker and verifies primitive compatibility; it does not complete Phase 11 or certify the proposed Vault protocol. Master-password wrapping/change, credential storage, biometric key protection, session locking, screenshot protection, clipboard policy and authenticated backups remain unimplemented/unverified. Existing dependency audit findings and production database encryption/key provisioning remain unresolved. New native adapter/library integration still needs independent security review before a production-security claim. No real secrets should be entered.

## Primary sources

- [SDK 58 Crypto, recommended version and AES APIs](https://docs.expo.dev/versions/v58.0.0/sdk/crypto/)
- [Noble 2.2.0 scheduler source](https://github.com/paulmillr/noble-hashes/blob/2.2.0/src/utils.ts)
- [Expo local modules](https://docs.expo.dev/modules/get-started/)
- [Expo coroutine/AsyncFunction API](https://docs.expo.dev/modules/module-api/)
- [Bouncy Castle official 1.86 distribution](https://www.bouncycastle.org/download/bouncy-castle-java/)
- [Bouncy Castle SCrypt implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/generators/SCrypt.java)
- [RFC 7914 vectors](https://www.rfc-editor.org/rfc/rfc7914#section-12)
