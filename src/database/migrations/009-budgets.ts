export const budgetsSchema: import('../types.ts').Migration = {
  version: 9,
  name: 'budget-snapshots-allocations-expense-links',
  sql: `
    CREATE TABLE budgets (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
      currency TEXT NOT NULL CHECK(currency IN ('PHP','USD','EUR')),
      starts_on TEXT NOT NULL CHECK(starts_on BETWEEN '1900-01-01' AND '9998-12-31' AND date(starts_on,'+0 days') IS starts_on),
      ends_on TEXT NOT NULL CHECK(ends_on>=starts_on AND ends_on<='9998-12-31' AND date(ends_on,'+0 days') IS ends_on),
      funding_minor INTEGER NOT NULL CHECK(typeof(funding_minor)='integer' AND funding_minor BETWEEN 0 AND 999999999999),
      source_snapshot TEXT NOT NULL CHECK(json_valid(source_snapshot)),
      archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL CHECK(updated_at>=created_at)
    );
    CREATE TABLE budget_accounts (
      budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
      account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      PRIMARY KEY(budget_id,account_id)
    );
    CREATE INDEX budget_accounts_source ON budget_accounts(account_id,budget_id);
    CREATE TABLE budget_allocations (
      id TEXT PRIMARY KEY NOT NULL,
      budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
      category_key TEXT NOT NULL,
      category_name TEXT NOT NULL CHECK(length(trim(category_name)) BETWEEN 1 AND 120),
      mode TEXT NOT NULL CHECK(mode IN ('fixed','percent')),
      value INTEGER NOT NULL CHECK(typeof(value)='integer' AND value>=0 AND ((mode='percent' AND value<=10000) OR (mode='fixed' AND value<=999999999999))),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL CHECK(updated_at>=created_at),
      UNIQUE(budget_id,category_key), UNIQUE(budget_id,id)
    );
    CREATE TABLE budget_transaction_links (
      id TEXT PRIMARY KEY NOT NULL,
      budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
      allocation_id TEXT NOT NULL,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      FOREIGN KEY(budget_id,allocation_id) REFERENCES budget_allocations(budget_id,id) ON DELETE RESTRICT,
      UNIQUE(budget_id,transaction_id)
    );
    CREATE INDEX budget_links_transaction ON budget_transaction_links(transaction_id);
    CREATE TABLE budget_funding_history (
      id TEXT PRIMARY KEY NOT NULL,
      budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
      previous_minor INTEGER NOT NULL CHECK(typeof(previous_minor)='integer' AND previous_minor>=0),
      funding_minor INTEGER NOT NULL CHECK(typeof(funding_minor)='integer' AND funding_minor BETWEEN 0 AND 999999999999),
      reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
      source_snapshot TEXT NOT NULL CHECK(json_valid(source_snapshot)), created_at TEXT NOT NULL
    );
    CREATE INDEX budget_period ON budgets(starts_on,ends_on,archived);
    CREATE INDEX budget_funding_budget ON budget_funding_history(budget_id,created_at);
    -- Expo exclusive transactions use a temporary connection: clean links even if its FK pragma is off.
    CREATE TRIGGER budget_expense_deleted AFTER DELETE ON transactions BEGIN
      DELETE FROM budget_transaction_links WHERE transaction_id=OLD.id;
    END;
  `,
};
