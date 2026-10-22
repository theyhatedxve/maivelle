import { invalid } from '../../finance/validation/financeInput.ts';
import { ledgerBalances } from '../../finance/services/financeLedger.ts';
import { DatabaseError } from '../../../database/errors.ts';

function fundingSources(json: string): {
  id: string;
  name: string;
  balanceMinor: bigint;
}[] {
  try {
    const rows = JSON.parse(json);
    if (!Array.isArray(rows)) throw new Error('Invalid source list');
    return rows.map((row) => {
      if (
        typeof row.id !== 'string' ||
        typeof row.name !== 'string' ||
        typeof row.balanceMinor !== 'string' ||
        !/^-?\d+$/.test(row.balanceMinor)
      )
        throw new Error('Invalid source');
      return {
        id: row.id,
        name: row.name,
        balanceMinor: BigInt(row.balanceMinor),
      };
    });
  } catch (error) {
    throw new DatabaseError(
      'CORRUPT_SNAPSHOT',
      'Budget funding history could not be read. Existing data was not changed.',
      error,
    );
  }
}
/** Largest-remainder rounding of the percentage pool; ties use stable allocation IDs. */
export function allocationAmounts(
  funding: number,
  allocations: {
    id: string;
    mode: string;
    value: number;
  }[],
) {
  const total = BigInt(funding);
  const percent = allocations.filter((a) => a.mode === 'percent');
  const basis = percent.reduce((sum, a) => sum + a.value, 0);
  if (basis > 10000) invalid('Percentages must total no more than 100%.');
  const amounts = new Map(
    allocations.map((a) => [
      a.id,
      a.mode === 'fixed' ? BigInt(a.value) : (total * BigInt(a.value)) / 10000n,
    ]),
  );
  const target = (total * BigInt(basis)) / 10000n;
  let extra = target - percent.reduce((sum, a) => sum + (amounts.get(a.id) ?? 0n), 0n);
  const ranked = [...percent].sort((a, b) => {
    const left = (total * BigInt(a.value)) % 10000n;
    const right = (total * BigInt(b.value)) % 10000n;
    return left === right ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : left > right ? -1 : 1;
  });
  for (const a of ranked)
    if (extra > 0n) {
      amounts.set(a.id, (amounts.get(a.id) ?? 0n) + 1n);
      extra--;
    }
  if ([...amounts.values()].reduce((sum, amount) => sum + amount, 0n) > total)
    invalid('Allocations exceed funding. Reduce allocations or explicitly adjust funding first.');
  return amounts;
}

export function eligibleExpense(
  budget: import('../../../database/repositories/budgetRepository.ts').Budget,
  scope: string[],
  row: import('../../../database/repositories/financeRepository.ts').FinancialTransaction,
  category: string,
) {
  return (
    row.type === 'expense' &&
    row.currency === budget.currency &&
    scope.includes(row.account_id) &&
    row.occurred_on >= budget.starts_on &&
    row.occurred_on <= budget.ends_on &&
    (row.category_key ?? 'uncategorized') === category
  );
}

export function budgetReports(
  model: import('../../../database/repositories/budgetRepository.ts').BudgetModel,
) {
  const accounts = ledgerBalances(model.finance.accounts, model.finance.transactions);
  return model.budgets.map((budget) => {
    const scope = model.scopes.filter((s) => s.budget_id === budget.id).map((s) => s.account_id);
    const allocations = model.allocations.filter((a) => a.budget_id === budget.id);
    const amounts = allocationAmounts(budget.funding_minor, allocations);
    const links = model.links.filter((l) => l.budget_id === budget.id);
    const rows = links.map((link) => {
      const transaction = model.finance.transactions.find((t) => t.id === link.transaction_id);
      const allocation = allocations.find((a) => a.id === link.allocation_id);
      return {
        ...link,
        transaction,
        valid:
          !!transaction &&
          !!allocation &&
          eligibleExpense(budget, scope, transaction, allocation.category_key),
      };
    });
    const categories = allocations.map((a) => {
      const allocated = amounts.get(a.id) ?? 0n;
      const spent = rows
        .filter((r) => r.allocation_id === a.id && r.valid)
        .reduce((sum, r) => sum + BigInt(r.transaction?.amount_minor ?? 0), 0n);
      return { ...a, allocated, spent, remaining: allocated - spent };
    });
    const allocated = categories.reduce((sum, a) => sum + a.allocated, 0n);
    const spent = categories.reduce((sum, a) => sum + a.spent, 0n);
    return {
      ...budget,
      scope,
      categories,
      links: rows,
      allocated,
      spent,
      unallocated: BigInt(budget.funding_minor) - allocated,
      remaining: BigInt(budget.funding_minor) - spent,
      accountBalance: accounts
        .filter((a) => scope.includes(a.id))
        .reduce((sum, a) => sum + a.balanceMinor, 0n),
      initialSources: fundingSources(budget.source_snapshot),
      fundingHistory: model.fundingHistory
        .filter((h) => h.budget_id === budget.id)
        .map((h) => ({ ...h, sources: fundingSources(h.source_snapshot) })),
    };
  });
}
