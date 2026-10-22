export const financeSchema: import('../types.ts').Migration = {
  version: 8,
  name: 'finance-accounts-categories-unified-ledger',
  sql: `
    CREATE TABLE financial_accounts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
      type TEXT NOT NULL CHECK(type IN ('cash','bank','ewallet','other')),
      currency TEXT NOT NULL DEFAULT 'PHP' CHECK(currency IN ('PHP','USD','EUR')),
      opening_minor INTEGER NOT NULL CHECK(typeof(opening_minor)='integer' AND opening_minor BETWEEN -999999999999 AND 999999999999),
      archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL CHECK(updated_at>=created_at)
    );
    CREATE TABLE transaction_categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
      kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
      color TEXT NOT NULL CHECK(length(color)=7 AND color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL CHECK(updated_at>=created_at)
    );
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense','income','transfer')),
      amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer' AND amount_minor BETWEEN 1 AND 999999999999),
      currency TEXT NOT NULL CHECK(currency IN ('PHP','USD','EUR')),
      account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      to_account_id TEXT REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      category_id TEXT REFERENCES transaction_categories(id) ON DELETE SET NULL,
      category_key TEXT, category_name TEXT, category_color TEXT,
      description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=2000),
      occurred_on TEXT NOT NULL CHECK(length(occurred_on)=10 AND occurred_on BETWEEN '1900-01-01' AND '9998-12-31' AND occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(occurred_on,'+0 days') IS NOT NULL AND date(occurred_on,'+0 days')=occurred_on),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL CHECK(updated_at>=created_at),
      CHECK((type='transfer' AND to_account_id IS NOT NULL AND to_account_id!=account_id AND category_id IS NULL AND category_key IS NULL) OR (type!='transfer' AND to_account_id IS NULL))
    );
    CREATE INDEX finance_accounts_active ON financial_accounts(archived,name,id);
    CREATE INDEX finance_categories_kind ON transaction_categories(kind,name,id);
    CREATE INDEX finance_transactions_date ON transactions(occurred_on DESC,created_at DESC,id);
    CREATE INDEX finance_transactions_account ON transactions(account_id,occurred_on DESC);
    CREATE INDEX finance_transactions_destination ON transactions(to_account_id,occurred_on DESC);
    CREATE INDEX finance_transactions_category ON transactions(category_id,occurred_on);
    CREATE TRIGGER finance_validate_insert BEFORE INSERT ON transactions BEGIN
      SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM financial_accounts WHERE id=NEW.account_id AND currency=NEW.currency)
        THEN RAISE(ABORT,'Account currency mismatch or missing account') END;
      SELECT CASE WHEN NEW.to_account_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM financial_accounts WHERE id=NEW.to_account_id AND currency=NEW.currency)
        THEN RAISE(ABORT,'Transfer currency mismatch or missing destination') END;
      SELECT CASE WHEN NEW.category_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM transaction_categories WHERE id=NEW.category_id AND kind=NEW.type)
        THEN RAISE(ABORT,'Category kind mismatch or missing category') END;
    END;
    CREATE TRIGGER finance_validate_update BEFORE UPDATE ON transactions BEGIN
      SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM financial_accounts WHERE id=NEW.account_id AND currency=NEW.currency)
        THEN RAISE(ABORT,'Account currency mismatch or missing account') END;
      SELECT CASE WHEN NEW.to_account_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM financial_accounts WHERE id=NEW.to_account_id AND currency=NEW.currency)
        THEN RAISE(ABORT,'Transfer currency mismatch or missing destination') END;
      SELECT CASE WHEN NEW.category_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM transaction_categories WHERE id=NEW.category_id AND kind=NEW.type)
        THEN RAISE(ABORT,'Category kind mismatch or missing category') END;
    END;
    CREATE TRIGGER finance_protect_account BEFORE DELETE ON financial_accounts WHEN EXISTS(SELECT 1 FROM transactions WHERE account_id=OLD.id OR to_account_id=OLD.id) BEGIN
      SELECT RAISE(ABORT,'Archive accounts with history instead of deleting them');
    END;
    CREATE TRIGGER finance_account_currency BEFORE UPDATE OF currency ON financial_accounts WHEN NEW.currency!=OLD.currency AND EXISTS(SELECT 1 FROM transactions WHERE account_id=OLD.id OR to_account_id=OLD.id) BEGIN
      SELECT RAISE(ABORT,'Account with history cannot change currency');
    END;
    CREATE TRIGGER finance_category_kind BEFORE UPDATE OF kind ON transaction_categories WHEN NEW.kind!=OLD.kind AND EXISTS(SELECT 1 FROM transactions WHERE category_id=OLD.id) BEGIN
      SELECT RAISE(ABORT,'Category with history cannot change kind');
    END;
  `,
};
