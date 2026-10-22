# Current development focus

Updated 22 October 2026 at the user's request.

Phase 13 device QA is paused. Continue application UI, feature and local
database/service development. Do not run HONOR device tests, native regression
suites, automated test suites, or a testing phase unless the user asks to resume.
Lint and TypeScript checks remain normal code maintenance checks.

## Diagnostic screens removed from the application

Eight diagnostic route files were moved from `src/app` into
`src/testing/screens`. The explicit database-diagnostics stack entry was removed.
These screens are no longer Expo Router destinations, including through deep
links. Their source and fixtures are retained for future maintenance, outside
the application route tree. Automated tests and historical QA evidence remain
in the repository; they do not execute on normal application startup.

The HONOR was not connected to ADB during this change. No app update, reload,
uninstall, data clear, fixture cleanup or device test was performed. Its currently
loaded code may still contain the old diagnostic screens until the development
app reloads from this workspace. Source-only route removal requires no native
dependency change or native rebuild. Do not claim the installed phone app has
already been updated.

## Preserved boundaries

- User databases, migration history, settings and Vault keys remain untouched.
- Existing backup/recovery, notifications and native cryptography remain intact.
- Existing automated checks are retained for when verification resumes.
- Production encryption activation and release approval remain outstanding.
- Backend work continues to mean local SQLite repositories and services under
  the existing offline architecture. No cloud backend or API was added.

Historical Phase 13 results remain evidence of their original executions, not
a claim that the current changes passed new physical verification.
