import { DatabaseError, storageError } from '../errors.ts';
import { financeId } from '../../features/finance/validation/financeInput.ts';
export type FinancialAccount = {
  id: string;
  name: string;
  type: string;
  currency: string;
  opening_minor: number;
  archived: number;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type FinancialCategory = {
  id: string;
  name: string;
  kind: string;
  color: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type FinancialTransaction = {
  id: string;
  type: string;
  amount_minor: number;
  currency: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  category_key: string | null;
  category_name: string | null;
  category_color: string | null;
  description: string;
  occurred_on: string;
  revision: number;
  created_at: string;
  updated_at: string;
  account_name: string;
  to_account_name: string | null;
  category_label: string;
  category_shade: string;
};
export type FinanceQuery = {
  search?: string;
  accountId?: string;
  categoryId?: string;
  type?: string;
  from?: string;
  to?: string;
  sort?: string;
  limit?: number;
  offset?: number;
};

const ledgerSelect = `SELECT t.*,a.name account_name,d.name to_account_name,COALESCE(c.name,t.category_name,'Uncategorized') category_label,COALESCE(c.color,t.category_color,'#8B5CF6') category_shade FROM transactions t JOIN financial_accounts a ON a.id=t.account_id LEFT JOIN financial_accounts d ON d.id=t.to_account_id LEFT JOIN transaction_categories c ON c.id=t.category_id`;
const sortSql = {
  newest: 't.occurred_on DESC,t.created_at DESC,t.id',
  oldest: 't.occurred_on,t.created_at,t.id',
  largest: 't.amount_minor DESC,t.occurred_on DESC,t.id',
};
/** Shared consistent ledger reader; caller owns the SQLite transaction. */
export async function readFinanceModel(tx: import('expo-sqlite').SQLiteDatabase) {
  return {
    accounts: (await tx.getAllAsync<import('../rows.ts').FinancialAccountsRow>(
      'SELECT * FROM financial_accounts ORDER BY archived,name COLLATE NOCASE,id',
    )) as FinancialAccount[],
    transactions: (await tx.getAllAsync(
      `${ledgerSelect} ORDER BY t.occurred_on DESC,t.created_at DESC,t.id`,
    )) as FinancialTransaction[],
  };
}

export function createFinanceRepository(
  db: import('expo-sqlite').SQLiteDatabase,
  createId: () => string,
) {
  let queue = Promise.resolve();

  function transaction<T>(
    action: (tx: import('expo-sqlite').SQLiteDatabase) => Promise<T>,
    check: boolean = true,
  ) {
    const operation = queue.then(async () => {
      let value: T | undefined;
      try {
        await db.withExclusiveTransactionAsync(async (tx) => {
          value = await action(tx);
          if (check && (await tx.getAllAsync('PRAGMA foreign_key_check')).length)
            throw new DatabaseError(
              'REFERENCE',
              'Financial references failed validation. No changes were committed.',
            );
        });
        return value as T;
      } catch (error) {
        throw storageError(error, 'save financial changes');
      }
    });
    queue = operation.then(
      () => {},
      () => {},
    );
    return operation;
  }

  const loadTransaction = (
    tx: import('expo-sqlite').SQLiteDatabase,
    id: string,
  ): Promise<FinancialTransaction | null> =>
    tx.getFirstAsync(`${ledgerSelect} WHERE t.id=?`, financeId(id));

  async function account(
    tx: import('expo-sqlite').SQLiteDatabase,
    id: string,
    allowedArchived: Set<string>,
  ) {
    const row = (await tx.getFirstAsync<import('../rows.ts').FinancialAccountsRow>(
      'SELECT * FROM financial_accounts WHERE id=?',
      financeId(id),
    )) as FinancialAccount | null;
    if (!row || (row.archived && !allowedArchived.has(id)))
      throw new DatabaseError(
        'REFERENCE',
        'Choose an existing, active account. Archived accounts may only retain their existing transactions.',
      );
    return row;
  }
  return {
    newTransactionId: () => financeId(createId()),
    async accounts() {
      return (await db.getAllAsync<import('../rows.ts').FinancialAccountsRow>(
        'SELECT * FROM financial_accounts ORDER BY archived,name COLLATE NOCASE,id',
      )) as FinancialAccount[];
    },
    async getAccount(id: string) {
      return (await db.getFirstAsync<import('../rows.ts').FinancialAccountsRow>(
        'SELECT * FROM financial_accounts WHERE id=?',
        financeId(id),
      )) as FinancialAccount | null;
    },

    saveAccount(
      id: string | null,
      revision: number | null,
      input: ReturnType<
        typeof import('../../features/finance/validation/financeInput.ts').validateAccount
      >,
      now: string,
    ) {
      return transaction(async (tx) => {
        if (id !== null) {
          const old = (await tx.getFirstAsync<import('../rows.ts').FinancialAccountsRow>(
            'SELECT * FROM financial_accounts WHERE id=?',
            financeId(id),
          )) as FinancialAccount | null;
          if (!old) throw new DatabaseError('NOT_FOUND', 'Account no longer exists.');
          if (old.revision !== revision)
            throw new DatabaseError('CONFLICT', 'Account changed. Reopen it before saving.');
          if (old.currency !== input.currency)
            throw new DatabaseError(
              'VALIDATION',
              'An existing account cannot change currency. Create another account.',
            );
          await tx.runAsync(
            'UPDATE financial_accounts SET name=?,type=?,opening_minor=?,archived=?,revision=revision+1,updated_at=MAX(updated_at,?) WHERE id=?',
            input.name,
            input.type,
            input.openingMinor,
            Number(input.archived),
            now,
            id,
          );
        } else {
          id = financeId(createId());
          await tx.runAsync(
            'INSERT INTO financial_accounts(id,name,type,currency,opening_minor,archived,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
            id,
            input.name,
            input.type,
            input.currency,
            input.openingMinor,
            Number(input.archived),
            now,
            now,
          );
        }
        return (await tx.getFirstAsync<import('../rows.ts').FinancialAccountsRow>(
          'SELECT * FROM financial_accounts WHERE id=?',
          id,
        )) as FinancialAccount;
      });
    },
    async categories() {
      return (await db.getAllAsync<import('../rows.ts').TransactionCategoriesRow>(
        'SELECT * FROM transaction_categories ORDER BY kind,name COLLATE NOCASE,id',
      )) as FinancialCategory[];
    },

    saveCategory(
      id: string | null,
      revision: number | null,
      input: ReturnType<
        typeof import('../../features/finance/validation/financeInput.ts').validateCategory
      >,
      now: string,
    ) {
      return transaction(async (tx) => {
        if (id !== null) {
          const old = (await tx.getFirstAsync<import('../rows.ts').TransactionCategoriesRow>(
            'SELECT * FROM transaction_categories WHERE id=?',
            financeId(id),
          )) as FinancialCategory | null;
          if (!old) throw new DatabaseError('NOT_FOUND', 'Category no longer exists.');
          if (old.revision !== revision)
            throw new DatabaseError('CONFLICT', 'Category changed. Refresh before saving.');
          if (old.kind !== input.kind)
            throw new DatabaseError(
              'VALIDATION',
              'An existing category cannot change between income and expense.',
            );
          await tx.runAsync(
            'UPDATE transaction_categories SET name=?,color=?,revision=revision+1,updated_at=MAX(updated_at,?) WHERE id=?',
            input.name,
            input.color,
            now,
            id,
          );
        } else {
          id = financeId(createId());
          await tx.runAsync(
            'INSERT INTO transaction_categories(id,name,kind,color,created_at,updated_at) VALUES(?,?,?,?,?,?)',
            id,
            input.name,
            input.kind,
            input.color,
            now,
            now,
          );
        }
        return (await tx.getFirstAsync<import('../rows.ts').TransactionCategoriesRow>(
          'SELECT * FROM transaction_categories WHERE id=?',
          id,
        )) as FinancialCategory;
      });
    },

    deleteCategory(id: string, revision: number, now: string) {
      return transaction(async (tx) => {
        const row = await tx.getFirstAsync<
          Pick<import('../rows.ts').TransactionCategoriesRow, 'revision'>
        >('SELECT revision FROM transaction_categories WHERE id=?', financeId(id));
        if (!row || row.revision !== revision)
          throw new DatabaseError('CONFLICT', 'Category changed or was removed. Refresh first.');
        // Explicit cleanup is also safe on Expo's temporary transaction handle when FK PRAGMAs are not inherited.
        await tx.runAsync(
          'UPDATE transactions SET category_id=NULL,revision=revision+1,updated_at=MAX(updated_at,?) WHERE category_id=?',
          now,
          id,
        );
        await tx.runAsync('DELETE FROM transaction_categories WHERE id=?', id);
        return true;
      });
    },
    getTransaction(id: string) {
      return loadTransaction(db, id);
    },
    /** A transfer is one row, never a separately persisted debit/credit pair. */
    saveTransaction(
      id: string | null,
      revision: number | null,
      submissionId: string,
      input: ReturnType<
        typeof import('../../features/finance/validation/financeInput.ts').validateTransaction
      >,
      now: string,
    ) {
      return transaction(async (tx) => {
        const recordId = financeId(id ?? submissionId);
        const existing = await loadTransaction(tx, recordId);
        if (id !== null && (!existing || existing.revision !== revision))
          throw new DatabaseError(
            'CONFLICT',
            'Transaction changed or was removed. Reopen it before saving.',
          );
        if (id === null && existing) {
          if (
            existing.type === input.type &&
            existing.amount_minor === input.amountMinor &&
            existing.account_id === input.accountId &&
            existing.to_account_id === input.toAccountId &&
            existing.category_id === input.categoryId &&
            existing.description === input.description &&
            existing.occurred_on === input.date
          )
            return existing;
          throw new DatabaseError(
            'CONFLICT',
            'This submission was already saved with different details. Open its history entry instead of submitting again.',
          );
        }
        const allowedArchived = new Set(
          [existing?.account_id, existing?.to_account_id].filter(
            (value) => typeof value === 'string',
          ),
        );
        const source = await account(tx, input.accountId, allowedArchived as Set<string>);
        if (input.toAccountId) {
          const destination = await account(tx, input.toAccountId, allowedArchived as Set<string>);
          if (destination.currency !== source.currency)
            throw new DatabaseError(
              'VALIDATION',
              'Transfers require two different accounts in the same currency. No conversion is available.',
            );
        }
        const category = input.categoryId
          ? ((await tx.getFirstAsync<import('../rows.ts').TransactionCategoriesRow>(
              'SELECT * FROM transaction_categories WHERE id=?',
              input.categoryId,
            )) as FinancialCategory | null)
          : null;
        if (input.categoryId && (!category || category.kind !== input.type))
          throw new DatabaseError('REFERENCE', 'Choose a category matching the transaction type.');
        // Deletion preserves snapshots. An explicit transaction edit assigns the selected current category (or Uncategorized).
        const categoryKey = category?.id ?? null;
        const categoryName = category?.name ?? null;
        const categoryColor = category?.color ?? null;
        if (existing) {
          await tx.runAsync(
            'UPDATE transactions SET type=?,amount_minor=?,currency=?,account_id=?,to_account_id=?,category_id=?,category_key=?,category_name=?,category_color=?,description=?,occurred_on=?,revision=revision+1,updated_at=MAX(updated_at,?) WHERE id=?',
            input.type,
            input.amountMinor,
            source.currency,
            input.accountId,
            input.toAccountId,
            input.categoryId,
            categoryKey,
            categoryName,
            categoryColor,
            input.description,
            input.date,
            now,
            recordId,
          );
        } else {
          await tx.runAsync(
            'INSERT INTO transactions(id,type,amount_minor,currency,account_id,to_account_id,category_id,category_key,category_name,category_color,description,occurred_on,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            recordId,
            input.type,
            input.amountMinor,
            source.currency,
            input.accountId,
            input.toAccountId,
            input.categoryId,
            categoryKey,
            categoryName,
            categoryColor,
            input.description,
            input.date,
            now,
            now,
          );
        }
        return (await loadTransaction(tx, recordId)) as FinancialTransaction;
      });
    },

    deleteTransaction(id: string, revision: number) {
      return transaction(async (tx) => {
        const row = await loadTransaction(tx, id);
        if (!row || row.revision !== revision)
          throw new DatabaseError('CONFLICT', 'Transaction changed or was removed. Refresh first.');
        await tx.runAsync('DELETE FROM transactions WHERE id=?', id);
        return true;
      });
    },
    /** Single-statement joined read; ordered/paged by reviewed static fragments. */
    async history({
      search = '',
      accountId,
      categoryId,
      type = 'all',
      from = '1900-01-01',
      to = '9998-12-31',
      sort = 'newest',
      limit = 50,
      offset = 0,
    }: FinanceQuery = {}) {
      if (
        typeof search !== 'string' ||
        !['all', 'expense', 'income', 'transfer'].includes(type) ||
        !Object.hasOwn(sortSql, sort) ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isSafeInteger(offset) ||
        offset < 0
      )
        throw new DatabaseError('VALIDATION', 'Invalid financial filters, sort or page.');
      if (accountId) financeId(accountId);
      if (categoryId) financeId(categoryId);
      return (await db.getAllAsync(
        `${ledgerSelect} WHERE (? IS NULL OR t.account_id=? OR t.to_account_id=?) AND (? IS NULL OR t.category_key=?) AND (?='all' OR t.type=?) AND t.occurred_on>=? AND t.occurred_on<=? AND (instr(lower(t.description),lower(?))>0 OR instr(lower(a.name),lower(?))>0 OR instr(lower(COALESCE(d.name,'')),lower(?))>0 OR instr(lower(COALESCE(c.name,t.category_name,'')),lower(?))>0) ORDER BY ${sortSql[sort as keyof typeof sortSql]} LIMIT ? OFFSET ?`,
        accountId ?? null,
        accountId ?? null,
        accountId ?? null,
        categoryId ?? null,
        categoryId ?? null,
        type,
        type,
        from,
        to,
        search,
        search,
        search,
        search,
        limit,
        offset,
      )) as FinancialTransaction[];
    },
    /** Consistent SQLite snapshot for exact BigInt aggregation; never SQL REAL/SUM overflow. */
    readModel() {
      return transaction(readFinanceModel, false);
    },
  };
}
