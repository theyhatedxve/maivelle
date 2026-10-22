# Maivelle

Offline-first Android personal management app built with Expo SDK 58, React Native,
TypeScript and Expo Router. Development uses Windows, VS Code and a physical HONOR
over USB. No emulator, cloud build, backend or online authentication is required.

Current focus: UI, features and local data/services. Physical HONOR testing and
the Phase 13 QA workstream are paused. Diagnostic screens have been removed from
app navigation; their source is archived outside the route tree. See
[current development focus](docs/development-focus.md) for phone-update status
and the boundaries for resuming verification.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd start
```

Use the installed Node 24 LTS toolchain (verified with 24.20.0). The existing local
development app loads the TypeScript code through Metro; source/type changes alone
do not require a native rebuild. See [Windows and USB setup](docs/development-setup.md)
for installing/building a development app when native changes actually require it.

The source layout and boundaries are documented in [architecture](docs/architecture.md).
Read [the TypeScript migration and maintenance guide](docs/typescript-migration.md)
before adding a route, feature, repository or migration. `.prettierrc.json` configures
VS Code's Prettier extension; no formatter dependency was added to the app.

Production encryption activation is still **NOT READY**. This language migration
does not authorize a live data conversion, key replacement, uninstall, data clear
or release APK. Preserve [the dependency baseline](docs/dependency-security-review.md)
and [the Stage 13A security/recovery boundaries](docs/stage-13a-security-handoff.md).
