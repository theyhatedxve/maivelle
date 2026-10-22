# Finance — Phase 9

Finance is a local expense/income tracker with accounts, transfers, searchable history and monthly reports. The existing `/finance` bottom tab and dashboard/More shortcuts open the Finance Dashboard. The preserved Budget link now opens the Phase 10 [Budget Divider](budget.md), which uses funding snapshots and links existing expenses without duplicating ledger rows. Finance services remain independent of Budget. No bank connection, account login, exchange-rate API, backend, telemetry or new native dependency was added.

## Routes and source boundaries

| Route | Screen |
| --- | --- |
| `/finance` | Existing bottom tab: balances, monthly PHP cash flow, recent entries and actions. |
| `/financial/accounts` | Active/archived/all account balances, edit, archive/restore, account-specific history. |
| `/financial/account/new`, `/financial/account/[id]` | Account forms, with opening-balance change confirmation and unsaved-change protection. |
| `/financial/transaction/new` | Income/expense form; the `type` query parameter chooses the initial type. |
| `/financial/transfer` | Two-account transfer form. |
| `/financial/transaction/[id]` | Existing entry editor and confirmed deletion. Transfers retain their transfer form. |
| `/financial/history` | Paginated history; optional `accountId` selects an account, including incoming transfers. |
| `/financial/categories` | Income/expense category management. |
| `/financial/reports` | Month/currency reports, six-month trends and spending charts. |

`financial` is a root stack alongside the existing tabs, like the Task editor stack. This avoids colliding with the existing Finance tab's `/finance` route. Routes only compose feature components. `src/features/finance/components` owns presentation/drafts, `hooks` owns refresh/save guards, `validation` owns input rules, `services` owns exact money/ledger calculations and mutations, and `src/database/repositories/financeRepository.js` owns SQL. No SQL appears in screens, and SQLite records are not duplicated in Zustand. Dashboard summaries refresh on focus, foreground, successful mutations and a focused minute check for date changes. History uses 50-row FlatList pages, stable sorting and stale-request protection.

## Migration 8 and schema

`008-finance.js` appends to the existing migration runner without altering migrations 1–7. The initializer retains its foreign-key, WAL and production encryption gates. No existing table is dropped or rebuilt, and no financial accounts, categories or transactions are seeded at startup.

| Table | Main fields and integrity rules |
| --- | --- |
| `financial_accounts` | UUID, name, Cash/Bank/E-Wallet/Other type, currency, signed integer `opening_minor`, archive flag, revision, UTC creation/update timestamps. Currency is fixed after creation through the service. |
| `transaction_categories` | UUID, name, income/expense kind, validated hex color, revision and UTC timestamps. Existing kind is fixed through the service. |
| `transactions` | Stable UUID, expense/income/transfer type, positive integer `amount_minor`, currency, source/account FK, optional destination FK, optional category FK and stable snapshot key/name/color, description, civil `occurred_on`, revision and UTC timestamps. |

Indexes cover account archive/name, category kind, transaction date, source account, destination and category. CHECK constraints enforce integer bounds, real civil dates and valid transfer structure. Triggers validate referenced accounts/currencies and category kind even on native transaction handles that do not inherit FK settings. Source/destination account deletion is restricted, with a protective trigger as well; the UI/service intentionally offers archive/restore rather than account deletion. Category deletion nulls its reference while retaining the original category key and snapshot. Transaction amounts and history remain intact. A recreated category with the same name has a different key and is not merged with a deleted historical category.

Multi-record operations use SDK 58 `withExclusiveTransactionAsync` and only its supplied handle. A repository queue serializes its own operations; a service mutation guard blocks overlapping form submissions. A final `foreign_key_check` precedes write commits, matching the established temporary-handle precautions. Reports read accounts and ledger rows in one SQLite transaction snapshot so a transfer/edit cannot be observed halfway through. Production encrypted transaction-handle key provisioning remains gated and unresolved upstream.

## Exact money representation

Default currency is **PHP**, where one peso is 100 centavos. PHP, USD and EUR are supported, all with two fractional digits. No other currency exponents or conversions are assumed. Currency totals always remain separate. The Home card shows recorded PHP balance; Finance shows all supported currency totals, and Reports has a currency selector.

An individual amount or opening balance is limited to **9,999,999,999.99** currency units (`999999999999` minor units). Transactions require strictly positive amounts. Opening balances can be positive, zero or negative. Decimal input is parsed from digit strings using integer arithmetic, never `parseFloat`, decimal multiplication or rounded peso values. Input permits at most ten whole digits and two decimal places, without commas, currency symbols, exponent notation or trailing decimal points. A signed opening balance uses a normal keyboard so Android can enter a minus sign.

Persisted amounts are bounded SQLite INTEGER values exactly representable by JavaScript Number. Derived totals use **BigInt minor units**, including formatting, so accumulating many large rows cannot silently lose centavos beyond `Number.MAX_SAFE_INTEGER`. SQL REAL and floating-point SUM are not used. The current report implementation reads the ledger snapshot and aggregates locally with BigInt; it also avoids SQLite 64-bit SUM overflow. Only chart ratios become Number after integer percentage calculation; those ratios are not financial source data. Exact text amounts accompany the installed `react-native-svg` charts. No new chart package is required.

History is paginated; report/balance calculation currently reads the full finance ledger. This keeps one exact calculation model and is appropriate for the current personal offline module. Performance on very large ledgers remains an acceptance check before introducing indexed rollups or caches. Any future optimization must preserve exact reconciliation and the existing source records.

## Unified ledger rules

For account A, in its own currency:

```text
balance(A) = opening(A)
           + income assigned to A
           - expenses assigned to A
           - transfers whose source is A
           + transfers whose destination is A
```

Every transfer is **one persisted row**, with a source, destination and positive amount. The two effects are calculated from that row, never stored as two independently saveable transactions or mutable account balance columns. Saving/editing/deleting a transfer is atomic: readers see the previous or next row, so both account effects change together. Transfers require different accounts with matching currencies. There is no conversion, automatic fee entry or transfer-income classification. Currency CHECKs and reference triggers supplement service validation.

Monthly income/expenses include only their own row types and selected currency/date range. Net cash flow is income minus expenses. Opening balances and transfers are excluded. Total recorded money is the sum of current account balances **including archived accounts**, separately per currency; it is not monthly net income. Reports explicitly label current balances as current/all-entered rather than balances at a historical month end.

Negative recorded balances are allowed. They are labelled on Accounts and can result from negative openings or expenses/transfers exceeding the recorded balance. Maivelle does not verify actual bank funds or model overdraft authorization. This policy permits faithful retrospective entry instead of blocking reconciliation.

Dates are validated civil `YYYY-MM-DD` dates (1900–9998), not timezone-shifted UTC instants. Future-dated postings are rejected; this phase does not implement forecasts. Timestamps identifying creation/modification are UTC ISO strings. Reports use civil calendar months; history ranges include both entered endpoint dates. Sorting is newest, oldest or largest raw minor amount, with stable ID tie-breaking. Mixed-currency largest-amount sorting does not imply conversion or purchasing-power comparison.

## Editing, duplicates, archive and categories

Transactions keep the same ID and creation timestamp on edit. The service does not add compensating copies or update cached balances; each read re-derives balances from the current ledger. Expected revisions reject stale edits/deletions. Every write increments the revision and keeps update timestamps from moving backwards. An opening-balance edit recalculates balance without adding income; the UI explicitly confirms this change.

A new transaction form creates a stable UUID **once** as its submission ID. Retrying the same committed submission with identical fields returns the existing row. Reusing that key with different details fails instead of duplicating or overwriting the entry. The synchronous button guard, disabled saving state, service guard, transaction queue and SQLite primary key provide complementary protection against repeated taps and commit/response retry windows. New forms intentionally get new keys; this is not a rule that forbids two legitimately identical transactions.

Archive preserves an account and all historical balances. New entries into archived source/destination accounts are rejected. Existing entries may retain their archived references when edited, but cannot acquire a newly selected archived account. Archiving/restoring triggers refresh. Account names/types/openings can be edited; currencies require a separate account. No account deletion action is exposed.

Categories are optional and must match income/expense. Transfers have no category. Category name/color changes appear in live reports while it exists. Deletion retains each transaction's recorded category snapshot and key. Editing such a transaction explains that saving it assigns Uncategorized unless another category is chosen. This reassignment is part of the explicit transaction edit, not a migration/startup rewrite. Delete confirmations, unsaved-change warnings, loading/empty/error states and retries are implemented throughout.

## Security and build requirements

**Development financial storage is unencrypted and fictional-only.** Preserve the existing SQLCipher configuration and SecureStore dependency; compiling SQLCipher is not proof that the opened database is keyed. The established production `ENCRYPTION_REQUIRED` gate still blocks storage before an application database is created. Key provisioning, encrypted temporary transaction handles, recovery and backup policy remain unresolved security work. Do not enter real balances, account identifiers or financial descriptions. Finance does not log these records or add analytics/network calls.

Only JavaScript, JSX, SQL migrations, tests and docs changed. The already installed Phase 7/8 Android development build supplies Router, SQLite/SQLCipher and SVG; no new native rebuild, Android permission, emulator or cloud build is needed. A device lacking those previously linked native modules needs the documented Windows local rebuild. The developer client still needs USB Metro for cold JavaScript startup; that is local transport, not an internet dependency or a completed production release.

## HONOR manual acceptance steps

Use fictional data only. See `development-setup.md` for USB Metro and local-build commands.

1. Open Finance → Accounts, create Cash PHP with opening `1000.01` and Bank PHP with `0.00`. Verify balances. Edit the cash name/type and opening; check the opening-change and unsaved-change confirmations.
2. Add income `100.00`, expense `0.01` and a transfer `200.00` from Cash to Bank. Verify Cash `900.00`, Bank `200.00`, total `1100.00`, monthly income `100.00`, expenses `0.01`, net flow `99.99`.
3. Double-tap Save and retry after interrupted response if practical. There should be one transfer row. Edit the expense to `0.02`; verify Cash `899.99`. Edit/reverse the transfer amount/accounts, then delete after confirmation and verify both balances reconcile.
4. Add expense and income categories; reject a category of the wrong kind. Rename and delete a category; amounts/history remain and reports retain its snapshot. Recreate the same name and confirm distinct history groups.
5. Archive Cash. Verify history/balance remains; new expense/transfer to it is blocked. Restore it. Record an expense beyond available balance and verify the explicit negative label.
6. Create a USD account and reject a PHP→USD transfer. Check separate currency totals and selected-currency reports; no combined converted total is shown.
7. Search literal descriptions (`100%_`), account names and categories. Filter account, income/expense/transfer, category and inclusive dates; sort and scroll multiple history pages. Account-specific history includes incoming transfers.
8. Try empty, zero, negative, malformed, excessive, fractional-cent amounts, invalid/future dates and same-account transfers. Verify no partial records. Test a fictional amount near the maximum and centavo edits; exact totals should reconcile.
9. Force-stop/reopen Maivelle through USB Metro and verify persisted entries/balances. Enable airplane mode, turn Wi-Fi off, verify those settings, then create/edit/search and open Reports. Restore original settings afterward.
10. Run all isolated suites at `/database-diagnostics`; inspect Home's live Finance balance and open Notes, Tasks, Calendar, Medicine and Timer. Do not uninstall or Clear storage to resolve migration failures.

Executed results and remaining checks are recorded in [phase-9-verification.md](phase-9-verification.md).

## Official references consulted

- [Expo SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/): async bound queries, exclusive transaction handles, persistence and SQLCipher configuration.
- [Expo SDK 58 Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/): routes, stack composition, parameters and unsaved-change prevention.
- [Expo SDK 58 SVG](https://docs.expo.dev/versions/v58.0.0/sdk/svg/): existing compatible chart primitives.
- [Expo documentation index](https://docs.expo.dev/llms.txt).
