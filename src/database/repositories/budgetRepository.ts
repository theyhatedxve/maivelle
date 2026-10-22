import { DatabaseError, storageError } from '../errors.ts';
import { readFinanceModel } from './financeRepository.ts';
import { ledgerBalances } from '../../features/finance/services/financeLedger.ts';
import { allocationAmounts, eligibleExpense } from '../../features/budget/services/budgetMath.ts';
import { financeId, invalid } from '../../features/finance/validation/financeInput.ts';
export type Budget = {
  id: string;
  name: string;
  currency: string;
  starts_on: string;
  ends_on: string;
  funding_minor: number;
  source_snapshot: string;
  archived: number;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type BudgetAllocation = {
  id: string;
  budget_id: string;
  category_key: string;
  category_name: string;
  mode: string;
  value: number;
  created_at: string;
  updated_at: string;
};
export type BudgetLink = {
  id: string;
  budget_id: string;
  allocation_id: string;
  transaction_id: string;
  created_at: string;
};
export type FundingChange = {
  id: string;
  budget_id: string;
  previous_minor: number;
  funding_minor: number;
  reason: string;
  source_snapshot: string;
  created_at: string;
};
export type BudgetModel = {
  budgets: Budget[];
  scopes: {
    budget_id: string;
    account_id: string;
  }[];
  allocations: BudgetAllocation[];
  links: BudgetLink[];
  fundingHistory: FundingChange[];
  finance: Awaited<ReturnType<typeof readFinanceModel>>;
  categories: import('./financeRepository.ts').FinancialCategory[];
};

export function createBudgetRepository(
  db: import('expo-sqlite').SQLiteDatabase,
  createId: () => string,
) {
  let queue = Promise.resolve();

  async function read(tx: import('expo-sqlite').SQLiteDatabase): Promise<BudgetModel> {
    return {
      budgets: await tx.getAllAsync<import('../rows.ts').BudgetsRow>(
        'SELECT * FROM budgets ORDER BY archived,starts_on DESC,id',
      ),
      scopes: await tx.getAllAsync<import('../rows.ts').BudgetAccountsRow>(
        'SELECT * FROM budget_accounts',
      ),
      allocations: await tx.getAllAsync<import('../rows.ts').BudgetAllocationsRow>(
        'SELECT * FROM budget_allocations ORDER BY created_at,id',
      ),
      links: await tx.getAllAsync<import('../rows.ts').BudgetTransactionLinksRow>(
        'SELECT * FROM budget_transaction_links ORDER BY created_at,id',
      ),
      fundingHistory: await tx.getAllAsync<import('../rows.ts').BudgetFundingHistoryRow>(
        'SELECT * FROM budget_funding_history ORDER BY created_at,id',
      ),
      finance: await readFinanceModel(tx),
      categories: await tx.getAllAsync<import('../rows.ts').TransactionCategoriesRow>(
        "SELECT * FROM transaction_categories WHERE kind='expense' ORDER BY name COLLATE NOCASE,id",
      ),
    };
  }

  function transaction<T>(
    action: (tx: import('expo-sqlite').SQLiteDatabase, model: BudgetModel) => Promise<T>,
  ) {
    const operation = queue.then(async () => {
      let result: T | undefined;
      try {
        await db.withExclusiveTransactionAsync(async (tx) => {
          result = await action(tx, await read(tx));
          if ((await tx.getAllAsync('PRAGMA foreign_key_check')).length)
            throw new DatabaseError(
              'REFERENCE',
              'Budget references are invalid. No changes were committed.',
            );
        });
        return result as T;
      } catch (error) {
        throw storageError(error, 'save budget changes');
      }
    });
    queue = operation.then(
      () => {},
      () => {},
    );
    return operation;
  }

  function current(
    model: BudgetModel,
    id: string,
    revision: number,
    allowArchived: boolean = false,
  ) {
    const row = model.budgets.find((b) => b.id === financeId(id));
    if (!row) throw new DatabaseError('NOT_FOUND', 'Budget no longer exists.');
    if (row.revision !== revision)
      throw new DatabaseError('CONFLICT', 'Budget changed. Reopen it before saving.');
    if (row.archived && !allowArchived) invalid('Restore this budget before changing it.');
    return row;
  }

  function snapshot(model: BudgetModel, ids: string[], currency: string) {
    const accounts = ledgerBalances(model.finance.accounts, model.finance.transactions);
    const sources = ids.map((id) => {
      const a = accounts.find((account) => account.id === id);
      if (!a || a.currency !== currency)
        invalid('All funding accounts must exist and use the budget currency.');
      return {
        id: a.id,
        name: a.name,
        balanceMinor: a.balanceMinor.toString(),
        archived: !!a.archived,
      };
    });
    return {
      sources,
      balance: sources.reduce((sum, a) => sum + BigInt(a.balanceMinor), 0n),
      json: JSON.stringify(sources),
    };
  }

  const touch = (tx: import('expo-sqlite').SQLiteDatabase, id: string, now: string) =>
    tx.runAsync(
      'UPDATE budgets SET revision=revision+1,updated_at=MAX(updated_at,?) WHERE id=?',
      now,
      id,
    );
  return {
    readModel: () => transaction(async (_tx, model) => model),

    create(
      input: ReturnType<
        typeof import('../../features/budget/validation/budgetInput.ts').validateBudget
      >,
      now: string,
    ) {
      return transaction(async (tx, model) => {
        const source = snapshot(model, input.accountIds, input.currency);
        if (source.sources.some((a) => a.archived)) invalid('Choose active funding accounts.');
        if (BigInt(input.funding) > source.balance)
          invalid('Funding exceeds the current combined account balance.');
        const overlap = model.budgets.some(
          (b) =>
            b.starts_on <= input.to &&
            b.ends_on >= input.from &&
            model.scopes.some(
              (s) => s.budget_id === b.id && input.accountIds.includes(s.account_id),
            ),
        );
        if (overlap)
          invalid(
            'A budget already reserves at least one selected account in this period, including archived budgets. Choose a different scope or a non-overlapping period.',
          );
        const id = financeId(createId());
        await tx.runAsync(
          'INSERT INTO budgets(id,name,currency,starts_on,ends_on,funding_minor,source_snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
          id,
          input.name,
          input.currency,
          input.from,
          input.to,
          input.funding,
          source.json,
          now,
          now,
        );
        for (const accountId of input.accountIds)
          await tx.runAsync(
            'INSERT INTO budget_accounts(budget_id,account_id) VALUES(?,?)',
            id,
            accountId,
          );
        await tx.runAsync(
          'INSERT INTO budget_funding_history(id,budget_id,previous_minor,funding_minor,reason,source_snapshot,created_at) VALUES(?,?,?,?,?,?,?)',
          createId(),
          id,
          0,
          input.funding,
          'Initial funding snapshot',
          source.json,
          now,
        );
        return id;
      });
    },

    edit(id: string, revision: number, name: string, archived: boolean, now: string) {
      return transaction(async (tx, model) => {
        current(model, id, revision, true);
        await tx.runAsync(
          'UPDATE budgets SET name=?,archived=?,revision=revision+1,updated_at=MAX(updated_at,?) WHERE id=?',
          name,
          Number(archived),
          now,
          id,
        );
      });
    },

    adjustFunding(id: string, revision: number, funding: number, reason: string, now: string) {
      return transaction(async (tx, model) => {
        const budget = current(model, id, revision);
        allocationAmounts(
          funding,
          model.allocations.filter((a) => a.budget_id === id),
        );
        const source = snapshot(
          model,
          model.scopes.filter((s) => s.budget_id === id).map((s) => s.account_id),
          budget.currency,
        );
        const increase = funding - budget.funding_minor;
        if (increase > 0 && BigInt(funding) > source.balance)
          invalid('New total funding exceeds current source balances.');
        await tx.runAsync(
          'INSERT INTO budget_funding_history(id,budget_id,previous_minor,funding_minor,reason,source_snapshot,created_at) VALUES(?,?,?,?,?,?,?)',
          createId(),
          id,
          budget.funding_minor,
          funding,
          reason,
          source.json,
          now,
        );
        await tx.runAsync('UPDATE budgets SET funding_minor=? WHERE id=?', funding, id);
        await touch(tx, id, now);
      });
    },

    saveAllocation(
      id: string,
      revision: number,
      input: ReturnType<
        typeof import('../../features/budget/validation/budgetInput.ts').validateAllocation
      >,
      now: string,
    ) {
      return transaction(async (tx, model) => {
        const budget = current(model, id, revision);
        const existing = model.allocations.filter((a) => a.budget_id === id);
        const old = input.id ? existing.find((a) => a.id === input.id) : null;
        if (input.id && !old) throw new DatabaseError('NOT_FOUND', 'Allocation no longer exists.');
        if (old && old.category_key !== input.categoryKey)
          invalid(
            'An allocation category is fixed to preserve its spending history. Set it to zero and create another allocation.',
          );
        const category = model.categories.find((c) => c.id === input.categoryKey);
        if (!category && input.categoryKey !== 'uncategorized' && !old)
          invalid('Choose an existing expense category.');
        const allocationId = old?.id ?? financeId(createId());
        if (existing.some((a) => a.id !== allocationId && a.category_key === input.categoryKey))
          invalid('This category already has an allocation. Edit it instead.');
        allocationAmounts(budget.funding_minor, [
          ...existing.filter((a) => a.id !== allocationId),
          { id: allocationId, mode: input.mode, value: input.value },
        ]);
        if (old)
          await tx.runAsync(
            'UPDATE budget_allocations SET mode=?,value=?,updated_at=MAX(updated_at,?) WHERE id=?',
            input.mode,
            input.value,
            now,
            allocationId,
          );
        else
          await tx.runAsync(
            'INSERT INTO budget_allocations(id,budget_id,category_key,category_name,mode,value,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
            allocationId,
            id,
            input.categoryKey,
            category?.name ?? 'Uncategorized',
            input.mode,
            input.value,
            now,
            now,
          );
        await touch(tx, id, now);
        return allocationId;
      });
    },

    setLink(
      id: string,
      revision: number,
      allocationId: string,
      transactionId: string,
      linked: boolean,
      now: string,
    ) {
      return transaction(async (tx, model) => {
        const budget = current(model, id, revision);
        financeId(allocationId);
        financeId(transactionId);
        const old = model.links.find(
          (l) => l.budget_id === id && l.transaction_id === transactionId,
        );
        if (!linked) {
          if (old?.allocation_id !== allocationId)
            invalid('Expense link changed. Refresh before unlinking.');
          await tx.runAsync('DELETE FROM budget_transaction_links WHERE id=?', old.id);
        } else {
          if (old) invalid('This expense is already linked inside this budget.');
          const allocation = model.allocations.find(
            (a) => a.id === allocationId && a.budget_id === id,
          );
          const expense = model.finance.transactions.find((t) => t.id === transactionId);
          const scope = model.scopes.filter((s) => s.budget_id === id).map((s) => s.account_id);
          if (
            !allocation ||
            !expense ||
            !eligibleExpense(budget, scope, expense, allocation.category_key)
          )
            invalid(
              'Choose an expense in this category, currency, account scope and inclusive budget period.',
            );
          await tx.runAsync(
            'INSERT INTO budget_transaction_links(id,budget_id,allocation_id,transaction_id,created_at) VALUES(?,?,?,?,?)',
            createId(),
            id,
            allocationId,
            transactionId,
            now,
          );
        }
        await touch(tx, id, now);
      });
    },
  };
}
