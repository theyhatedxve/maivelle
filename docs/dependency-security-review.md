# npm dependency security review — 20 October 2026

This review covers the actual `maivelle-local-app` checkout on Windows, using Node 24.20.0 and npm 11.19.0. Dependencies, install-script approvals, application source, native crypto, device data and Vault keys were not changed. `package.json` and `package-lock.json` SHA-256 values were checked before and after the audit dry run and remained identical. Pre-existing worktree changes were preserved. No Phase 13 work was performed.

## Scope and reproduced results

Read `AGENTS.md`, package manifests, installed package sources and native crypto dependency declarations. Consulted [Expo SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/) and [npm audit behavior](https://docs.npmjs.com/cli/v11/commands/npm-audit/).

| Command | Result |
| --- | --- |
| `npm run check:dependencies` | Dependencies up to date for installed Expo 58.0.16 |
| `npm run doctor` | 20/20 checks passed |
| `npm audit --omit=dev --json` | 26 findings: 19 high, 7 moderate; expected exit 1 |
| `npm audit --json` | Same 26 findings, three distinct advisory roots |
| `npm audit fix --dry-run --ignore-scripts --json` | Expected exit 1; remaining report still 26; no changes applied and lifecycle scripts explicitly disabled |
| `npm ls braces node-forge postcss-selector-parser uuid unrs-resolver --all` | Exact paths below; no selector-parser installed |
| `npm ls tailwindcss nativewind postcss-selector-parser --all` | Empty |
| `npm run lint` | Passed, zero warnings |
| `npm run typecheck` | Passed, JavaScript/JSDoc checking |
| `npm run test:vault` | 14/14 passed |
| `npm run test:database` | 137/137 passed |
| Local Android production JavaScript export with source maps | Passed; bundle reachability inspection below |

The reported 35 findings (22 high, 13 moderate) and Tailwind change proposal could not be reproduced in this checkout. Neither Tailwind nor `postcss-selector-parser` appears in its installed tree or lockfile. A different checkout, working directory, lockfile or audit snapshot may explain the difference, but the original report is unavailable here. Do not apply fixes for an assumed tree. Raw evidence is saved locally in ignored `.expo/dependency-audit-{production,all,dry-run}.json`; npm's dry-run output contains progress lines before its JSON object.

`--omit=dev` does not determine Android runtime reachability. Expo is a production manifest dependency and brings its Node CLI/build packages with it. npm counts packages affected through their dependency graph as well as direct advisory roots; 26 entries do not mean 26 independent Android exploits. See [npm's explanation of meta-vulnerabilities](https://docs.npmjs.com/cli/v11/commands/npm-audit/#calculating-meta-vulnerabilities-and-remediations).

## Findings and exposure

Severity below is npm's classification. Exposure is this review's assessment based on installed callers, inputs and application source; it is not a universal dismissal of the advisories.

| Package / exact installed version | Advisory and affected operation | Exposure in Maivelle | Patched version / recommendation |
| --- | --- | --- | --- |
| `braces 3.0.3` — high | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): deeply nested brace patterns exhaust the stack; affected through 3.0.3 | Development/build-time Metro file watching/glob processing. Watcher patterns are constructed from tool configuration/extensions; filenames are the matched subjects, not arbitrary glob programs. No app user-content path into brace expansion was found. Malicious project configuration/plugins or future untrusted pattern services could expose it. | Registry latest is 3.0.3; advisory lists no patch. The old suggestion to update to 3.0.3 addresses older advisories, not this one. No verified patched override exists today. Keep project/config inputs trusted and Metro local/USB; monitor upstream. |
| `node-forge 1.4.0` — high | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv): RSA PKCS#1 v1.5 verification accepts malformed nested DigestAlgorithm elements, relevant to low-exponent RSA keys | Development/build-time Expo certificate/manifest-signing helpers and iOS signing utilities. Expo's helper really calls `certificate.verify` and `publicKey.verify`; this is not an unused dependency everywhere. Current Android project has no configured remote update-signing workflow and no direct forge use in app/Vault code. Hostile certificates/signatures entering these helpers would require renewed analysis. | Registry latest 1.4.0; no patch listed. Do not replace Vault cryptography: it does not use forge. Avoid adding untrusted certificate/CSR/update-signing inputs; prefer an upstream reviewed fix when released. |
| `uuid 7.0.3` — moderate | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): missing output-buffer bounds checks in v3/v5/v6; malformed/partial identifiers rather than evidence of native arbitrary memory corruption | Build/config tooling via `xcode 3.0.1`. Installed Xcode caller uses `uuid.v4()` with no buffer/offset, not the affected operations. Maivelle's runtime `import { uuid } from 'expo'` uses Expo Modules Core's native UUID implementation, not npm uuid 7.0.3. No affected user-controlled buffer path found. | 11.1.1 is the earliest patched line; also 12.0.1/13.0.1. No patched 7.x release found. A scoped `xcode -> uuid@11.1.1` override is a candidate only, not a verified SDK-compatible fix: it crosses four majors and Xcode declares `^7.0.3`. Version 11.1.1 exposes a CommonJS require entry, but that alone does not prove compatibility. Do not apply without isolated consumer/config tests. |
| `postcss-selector-parser` — not installed | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf): quadratic parsing of crafted flat selectors, affected below 7.1.6 | No installed dependency or app call path in this checkout. If introduced through a Phase 12 CSS stack, normally a build-time concern with trusted CSS; untrusted selectors parsed at runtime change exposure. | 7.1.6 fixes this advisory; registry latest is 7.1.7. These are reference versions, not a tested recommendation to add/override an absent package. Reaudit the actual CSS consumer and all its advisories if that tree becomes available. |
| `unrs-resolver 1.12.2` — install-script warning | No vulnerability entry for this package in the current npm audit; script execution is a separate supply-chain concern | Development-time ESLint import resolver, with a Windows native binary. It is not Maivelle's Android crypto dispatcher. See investigation below. | Existing Windows binding is present and lint succeeds. No need established to run/approve its postinstall repair helper. Leave approval unchanged. |

### Exact dependency paths

```text
expo@58.0.16
  @expo/metro@58.0.0
    metro-file-map@0.87.1
      micromatch@4.0.8
        braces@3.0.3

expo@58.0.16
  @expo/cli@58.1.13
    node-forge@1.4.0
    @expo/code-signing-certificates@0.0.7
      node-forge@1.4.0 (deduplicated)

expo@58.0.16
  @expo/config-plugins@58.0.9
    xcode@3.0.1
      uuid@7.0.3

eslint-config-expo@58.0.4
  eslint-import-resolver-typescript@3.10.1
    unrs-resolver@1.12.2
      napi-postinstall@0.3.4
      @unrs/resolver-binding-win32-x64-msvc@1.12.2 (optional platform binding)
```

These are representative root-to-leaf paths confirmed by `npm ls`; other Expo/React Native paths converge on the same Metro packages.

### All packages flagged by the reproduced audit

Direct advisory roots: `braces 3.0.3`, `node-forge 1.4.0`, `uuid 7.0.3`.

The remaining entries inherit findings through those dependency paths: `@expo/cli 58.1.13`, `@expo/code-signing-certificates 0.0.7`, `@expo/config 58.0.6`, `@expo/config-plugins 58.0.9`, `@expo/inline-modules 0.2.6`, `@expo/local-build-cache-provider 58.0.6`, `@expo/metro 58.0.0`, `@expo/metro-config 58.0.15`, `@expo/prebuild-config 58.0.14`, `@react-native/community-cli-plugin 0.88.0`, `@react-native/metro-config 0.88.0`, `@react-native/virtualized-lists 0.88.0`, `expo 58.0.16`, `expo-modules-core 58.0.23`, `metro 0.87.1`, `metro-config 0.87.1`, `metro-file-map 0.87.1`, `metro-transform-worker 0.87.1`, `micromatch 4.0.8`, `react-native 0.88.0`, `react-native-reanimated 4.7.1`, `react-native-worklets 0.13.0`, `xcode 3.0.1`.

Some flagged parents are runtime libraries. Their presence in Android does not establish that the Node build-tool advisory code is reachable there. Conversely, npm's graph and source inspection are not a complete native/release security review. Expo Doctor verifies configuration/compatibility, not exploitability.

### Android bundle reachability check

Ran `node node_modules/expo/bin/cli export --platform android --source-maps --output-dir .expo/dependency-audit-android --max-workers 2` using the installed CLI. It successfully produced the Android Hermes bundle and source map locally. Inspected all **3,490 source entries**: none belonged to npm `braces`, `micromatch`, `node-forge`, `uuid`, `xcode`, `unrs-resolver`, `napi-postinstall` or `postcss-selector-parser`. Expo Modules Core's UUID implementation was present, consistent with the inspected runtime imports. The machine-readable summary is `.expo/dependency-audit-bundle-scan.json`.

This provides concrete evidence that the affected JavaScript packages are absent from this generated production Android bundle. It is not a scan of the installed development APK, native libraries, dynamically supplied future bundles or an assertion that build/install exposure is harmless. The export included harmless Node `NO_COLOR`/`FORCE_COLOR` warnings. No native rebuild or device interaction was necessary for this unchanged-dependency review; previous physical-device security results were not presented as newly rerun tests.

## Install-script investigation

Inspected installed `unrs-resolver/postinstall.js`, its package metadata/lock integrity fields, `napi-postinstall/lib/index.js`, helper/fallback code and the platform binding manifest. The script calls `checkAndPreparePackage(packageJson, true)`. It checks that native binding package versions agree and resolves the appropriate platform file. If missing, it can spawn a nested npm install, or download a tarball and extract/write its binary. The inspected direct-download fallback has no explicit lockfile SRI verification. This is executable supply-chain behavior, not merely an informational script.

The [maintainer explains](https://github.com/unrs/unrs-resolver/issues/193) that the v1 script supports legacy npm optional-binding installation behavior. That explanation does not certify binary safety. The lockfile pins `unrs-resolver 1.12.2`, `napi-postinstall 0.3.4` and the Windows x64 binding 1.12.2 with registry URLs and SHA-512 integrity values. The matching `.node` file is already installed. No repair was needed for this review's successful lint run. Lock metadata alone does not attest the installed binary's contents or the script's historical execution.

Current npm settings: `ignore-scripts=false`, `strict-allow-scripts=false`, empty CLI `allow-scripts`; package.json has no explicit `allowScripts` policy. Under [npm 11's documented policy](https://docs.npmjs.com/cli/v11/using-npm/config/#strict-allow-scripts), unreviewed scripts can run with a notice when strict mode is false. A warning does **not** prove execution was blocked. The original installation log was not supplied, so historical execution cannot be established. This review did not invoke the script, approve it, run `npm rebuild`, or change npm policy. All audit-fix simulation used `--ignore-scripts`.

If a fresh install later fails from a missing binding, first inspect the exact platform package/version/integrity and native file availability. Any change to script policy should be explicitly reviewed, package-scoped and tested in an isolated install. Do not globally approve scripts or suppress notices to make the warning disappear. An explicit deny policy is also a behavior change for future fresh installs and should be validated before adoption; blanket script disabling can break unrelated native tooling.

## Minimal remediation plan and approval boundary

1. **Keep the current SDK 58 tree for now.** No safe blanket `npm audit fix` was identified. The dry run proposes Reanimated **4.7.1 -> 4.2.2** and `react-native-is-edge-to-edge` **1.3.1 -> 1.2.1**, plus CLI dependency relocation. These do not fix the three root advisories and could change native compatibility. Do not apply them merely to alter audit counts.
2. **Do not force npm's suggested downgrade.** Audit metadata proposes Expo **44.0.6** and React Native **0.72.17** to escape inherited ranges. Those violate SDK 58 compatibility and user constraints; no force command was run. No Tailwind proposal exists in this actual tree.
3. **Track upstream braces/forge fixes**, then evaluate exact compatible versions against the installed Expo/Metro consumers. Do not invent nonexistent patched versions or pin older affected releases.
4. **Optional narrowly scoped uuid remediation:** only after isolated tests, consider pinning `uuid 11.1.1` under `xcode`, not a global UUID replacement. It is out of the parent's declared range, is currently unnecessary to remove an observed exploit path, and requires explicit approval plus compatibility evidence before adoption. No override was installed or claimed safe.
5. **Keep the current local/USB development workflow.** Do not feed untrusted glob configuration or signing material into affected tools. Ordinary app records/imports are not a substitute path into those tool operations. No configuration change was made as part of this recommendation.
6. **Review script policy separately.** Explicit approval/denial of install scripts is not an audit vulnerability fix. Any package-scoped policy change requires a clean-install verification; no automatic approval is warranted here.

There is no proposed major dependency update awaiting approval. The only optional changes needing a deliberate follow-up decision are the unvalidated cross-major scoped uuid override and install-script policy adjustment; both should first be made concrete in an isolated test tree. This review does not ask permission for a vague or untested change.

## Validation after an eventual remediation

Run the full/production npm audits, inspect the lockfile diff and `npm ls` for invalid/duplicate consumers, then Expo compatibility, Doctor, lint and JavaScript type checks. For a uuid override, test Xcode UUID generation, project parsing/serialization and Expo config evaluation without touching generated user projects. For CSS changes, test the actual consumer's Android/CSS bundle rather than installing Tailwind just for this review. For script-policy changes, test a clean Windows install with exact optional bindings and no unreviewed scripts.

Run database and Vault host suites, Android production JavaScript bundling and an isolated local Android build. On the physical HONOR, use a replacement install (never uninstall/clear data), then verify navigation, existing records, Vault password/biometric unlock, encrypted CRUD, background locking and backup authentication with fictional fixtures. Native dependency changes such as Reanimated require a native rebuild; tooling-only changes should still receive build smoke coverage. Preserve the scrypt dispatcher/work factors, SQLCipher configuration and all existing keys/data.

The npm audit does not assess Maven/Bouncy Castle, Android platform vulnerabilities, all install-time supply-chain risks, or Maivelle's custom envelope protocol. `@noble/hashes`, `expo-crypto` and `expo-secure-store` have no entries in this audit snapshot; that is not a security certification. No native crypto remediation was justified by these findings.

## 21 October 2026 — approved Phase 13 appearance exception

Physical QA confirmed System appearance stayed Light with Android Dark. The user explicitly approved SDK-matched `expo-system-ui ~58.0.6` (installed 58.0.6), automatic appearance/config plugin and a local replacement development build. Expo's SDK-aware install ran with npm lifecycle scripts disabled via a process-only environment setting; no install-script approval/policy change, override or audit fix was made. Exactly one package was added. Removing just SystemUI from the new package/lock JSON reconstructs both historical baseline hashes, confirming all prior dependency versions remain unchanged, including Reanimated 4.7.1. The install audit still reported 26 findings (19 high/7 moderate); this UI addition does not remediate them. Native crypto/KDF, schema, app identity and keys remain unchanged. Final validation is recorded in [Phase 13 results](phase-13-test-results.md); the original review above remains a historical snapshot.


## Phase 13 continuation audit - 21 October 2026

Read-only audit refresh still reports 26 findings (19 high, 7 moderate); exact installed families remain braces 3.0.3, node-forge 1.4.0, uuid 7.0.3 and unrs-resolver 1.12.2. No app dependency edits, overrides, force fixes, rebuild scripts or install-script approvals were applied. Doctor 20/20 and installed SDK compatibility passed with host network access after sandbox EACCES; no network/firewall policy changed. Current Android export succeeded: 4923008 bytes, 3,557 mapped sources. The inspected tooling families again have zero source-map entries. This remains a scoped JavaScript reachability observation, not elimination of host/build/install/native or future-call-path risk. Raw refresh: `.expo/phase13-resume-audit.json`; build/map scan: `.expo/phase13-resume-build-evidence.json`. Existing residual-risk/remediation approvals remain unchanged.
