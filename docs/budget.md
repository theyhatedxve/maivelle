# Budget Divider — Phase 10

Budget is a local spending plan over existing Finance accounts. It does not move money, change account balances, reserve bank funds or create expense rows. Development storage is **unencrypted and synthetic-only**. The production `ENCRYPTION_REQUIRED` gate, SQLCipher native setting and Android backup restriction remain intact. SecureStore key provisioning/recovery is unresolved; do not enter real financial information.

## Funding and periods

- Create a named single-currency budget (PHP default; USD/EUR supported separately) with one or more active accounts in that currency. Choose inclusive civil start/end dates. The form defaults to the current calendar month; arbitrary valid custom ranges are supported.
- The selected funding amount is a fixed snapshot captured **now**, not a reconstruction of balances at the period start. It may be zero, cannot be negative, and cannot exceed current combined source balances. Per-account IDs, names and exact balance strings are recorded with the snapshot. Money is bounded to 999,999,999,999 centavos per budget, matching Finance's per-amount limit; aggregate Finance balances remain BigInt.
- Subsequent expenses, transfers, opening-balance edits, account renames or archives never silently change budget funding. Scope, currency and period are immutable. Name and archive state are editable.
- An explicit funding adjustment records the old/new total, reason, current source snapshot and timestamp. Increasing the total must fit the current source balance; this conservative rule may reject increases after spending. Decreasing must still cover fixed plus recalculated percentage allocations. The original source snapshot is retained. This audit is application history, not a tamper-proof log.
- Any shared account with an inclusive overlapping period rejects creation, even for partially funded or archived budgets. This deliberately conservative rule avoids reusing the same source funds by creating overlapping plans. Archiving does not release the scope; use an adjacent future period or a disjoint account scope. There is no destructive budget deletion or overlap override.

## Allocations and exact arithmetic

Reuse Finance **expense** categories, including an Uncategorized allocation. Create missing categories in Finance. Each budget permits one allocation per stable category key. A category's name is captured for history; deleting it in Finance does not destroy existing allocations or expense classification snapshots.

- Fixed values store integer centavos. Percentages store integer basis points (50.25% = 5025), with at most two decimal places.
- Percentage shares are computed from the **entire funding snapshot**, not from the funds left after fixed allocations. Mixed fixed/percentage plans are allowed only if their sum fits funding.
- Compute each percentage floor using BigInt. The percentage pool is `floor(funding × total basis points / 10000)`. Distribute its remaining centavos to the largest fractional remainders, with stable allocation ID as the tie breaker. Array ordering cannot change rounding.
- `unallocated = funding − sum(allocations)`.
- `remaining allocation = allocation − valid linked expenses`.
- `budget remaining = funding − total valid linked expenses`. This includes unallocated funds; it differs from both category availability and current account balance.
- Spending may exceed an allocation and produces a visible overspending warning. Planned over-allocation is rejected, rather than silently clamped. Zero funding/allocations are supported.
- Edit allocation amounts/modes while keeping IDs, creation dates and spending links. Category identity cannot change. To retire an allocation, set it to zero; it remains visible with any spending history. No hard-delete allocation operation is supplied.

## Finance integration

Budget uses the shared Finance repository ledger reader within its own consistent SQLite snapshot. No SQL is placed in screens and no persistent ledger copies are introduced. Finance's service remains independent of Budget. Budget views listen to both services and reload on navigation focus, app foreground and periodic date refresh.

Open an allocation to see matching expenses and explicitly link them. Eligibility requires an expense (not income/transfer), matching currency, a source account in scope, matching stable category key and a date inside the inclusive period. Each `(budget_id, transaction_id)` is unique. Linking/unlinking does not change the Finance row or balance. There is no automatic expense import or allocation matching.

Reports read the current amount from Finance. Editing its amount updates spending; changing category, currency, source account, date or type outside eligibility retains a reviewable link but excludes it from spending. Correct the Finance record or unlink it. Deleted transactions remove links through both a foreign key and an `AFTER DELETE` trigger; the trigger also handles Expo's exclusive transaction connections where foreign keys are not inherited. This lets Finance operate independently. Archived budgets retain reports, including later Finance corrections, and disallow allocation/link/funding changes until restored.

Reports display full-period allocated/spent/remaining per category, progress, overspending, monthly linked-spending totals and funding audit history. Monthly rows group actual linked expenses without prorating full-period allocations. Custom budget dates are reported as stored. Home shows the sum of remaining plans for active current-period **PHP** budgets; other currencies remain separate inside Budget. It is explicitly labeled as a plan, not account balance.

## Storage and routes

Migration **9** adds `budgets`, `budget_accounts`, `budget_allocations`, `budget_transaction_links` and `budget_funding_history`, indexes and the transaction-delete cleanup trigger. Prior migrations are unchanged. Writes are exclusive transactions with a queue, foreign-key checks and optimistic budget revisions; invalid or stale writes roll back without resetting data. Individual SQL values are bound parameters. The original connection lifecycle, WAL and migration runner are reused.

Routes: `/budget`, `/budget/new`, `/budget/[id]`, `/budget/[id]/edit`, `/budget/[id]/divide`, `/budget/[id]/allocation/[allocationId]`, `/budget/[id]/history`, `/budget/[id]/reports`. `/budget` replaces the placeholder at the same public URL; all existing shortcuts remain valid. Editors guard unsaved changes and rapid save taps. Lists use FlatList, forms use the established keyboard-aware safe-area layout, and existing theme/UI/Finance field controls are reused.

Current consistent snapshots load the local ledger and budget rows before calculation; this prioritizes exact BigInt arithmetic and integration correctness over very large history scalability. There is no background sync, network call, exchange conversion, automatic carry-forward, recurring funding, notification, cloud service, bank connection or Vault implementation. Native packages and app configuration are unchanged: Metro reload is sufficient on the existing development build. A future native dependency/plugin change still requires a local Android rebuild.

## HONOR manual checks

Use fictional records only. Connect/unlock/authorize USB, start `npm.cmd run start:usb -- --port 8085`, and run `adb -d reverse tcp:8085 tcp:8085` (full localhost client launch is in development-setup.md). No emulator or cloud build is involved.

1. In Finance create two fictional PHP accounts with known openings and an expense category. Record the initial balances.
2. Create a current-month budget selecting both accounts. Verify its funding is capped by their combined balance and that a duplicate overlapping scope is rejected.
3. Add fixed and percentage allocations, including fractional centavo rounding. Reject totals over funding, negative values, blank name and invalid dates. Check zero values.
4. Record an expense in Finance in the matching category/scope/period. Link it from the allocation. Confirm only one expense exists and Finance balances are unchanged by linking. Unlink/relink. Income and transfers must not appear as eligible expenses.
5. Edit the Finance amount and verify spending refreshes. Move its date/category outside the budget, review the excluded link, then correct or unlink it. Delete the expense with Finance confirmation and verify no spending remains.
6. Edit an allocation and verify history survives. Adjust funding with a reason; inspect the audit and unchanged original snapshot. Exercise unsaved-change Back handling.
7. Open history/reports, check monthly totals, archive and restore. Archived history should remain readable; its scope must still reject overlap. Home's remaining-plan summary should refresh.
8. Force-stop and reopen Maivelle; verify snapshots, allocations and links persist. Enable airplane mode and turn Wi-Fi off, leaving USB/Metro connected, and repeat an allocation edit/link/report check. Restore the original connectivity settings afterward. This verifies no internet requirement; the development client still obtains its JavaScript from local USB Metro.
9. Open Notes, Tasks, Calendar, Medicine, Timer and Finance to check navigation and existing records. Development `/database-diagnostics` provides isolated native suites; they do not reset the application database.

Official references consulted: [Expo SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/), [SDK 58 Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/) and [Expo documentation index](https://docs.expo.dev/llms.txt).
