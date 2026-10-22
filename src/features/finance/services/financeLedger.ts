import { financeDate, invalid } from '../validation/financeInput.ts';

export function financialToday(now: Date = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function monthBounds(month: string) {
  if (typeof month !== 'string' || !/^\d{4}-\d\d$/.test(month))
    invalid('Choose a month in YYYY-MM format.');
  const from = financeDate(`${month}-01`);
  const date = new Date(`${from}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return { from, to: date.toISOString().slice(0, 10) };
}
/** One transfer row yields a debit and credit only during calculation, not two persistent transactions. */
export function ledgerBalances(
  accounts: import('../../../database/repositories/financeRepository.ts').FinancialAccount[],
  rows: import('../../../database/repositories/financeRepository.ts').FinancialTransaction[],
) {
  const balances = new Map(accounts.map((account) => [account.id, BigInt(account.opening_minor)]));
  for (const row of rows) {
    const amount = BigInt(row.amount_minor);
    balances.set(
      row.account_id,
      (balances.get(row.account_id) ?? 0n) + (row.type === 'income' ? amount : -amount),
    );
    if (row.type === 'transfer' && row.to_account_id)
      balances.set(row.to_account_id, (balances.get(row.to_account_id) ?? 0n) + amount);
  }
  return accounts.map((account) => ({
    ...account,
    balanceMinor: balances.get(account.id) ?? 0n,
  }));
}

export function financeReport(
  model: {
    accounts: import('../../../database/repositories/financeRepository.ts').FinancialAccount[];
    transactions: import('../../../database/repositories/financeRepository.ts').FinancialTransaction[];
  },
  month: string,
  currency: string,
) {
  const { from, to } = monthBounds(month);
  const accounts = ledgerBalances(model.accounts, model.transactions);
  const totals: Map<string, bigint> = new Map();
  for (const account of accounts)
    totals.set(account.currency, (totals.get(account.currency) ?? 0n) + account.balanceMinor);
  let incomeMinor = 0n;
  let expenseMinor = 0n;
  const categories: Map<
    string,
    {
      id: string;
      name: string;
      color: string;
      amountMinor: bigint;
    }
  > = new Map();
  const trends = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${from}T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() - 5 + index);
    return {
      month: date.toISOString().slice(0, 7),
      incomeMinor: 0n,
      expenseMinor: 0n,
    };
  });
  for (const row of model.transactions) {
    if (row.currency !== currency || row.type === 'transfer') continue;
    const amount = BigInt(row.amount_minor);
    const trend = trends.find((item) => item.month === row.occurred_on.slice(0, 7));
    if (trend) {
      if (row.type === 'income') trend.incomeMinor += amount;
      else trend.expenseMinor += amount;
    }
    if (row.occurred_on < from || row.occurred_on >= to) continue;
    if (row.type === 'income') incomeMinor += amount;
    else {
      expenseMinor += amount;
      const id = row.category_key ?? 'uncategorized';
      const item = categories.get(id) ?? {
        id,
        name: row.category_label,
        color: row.category_shade,
        amountMinor: 0n,
      };
      item.amountMinor += amount;
      categories.set(id, item);
    }
  }
  return {
    month,
    currency,
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    accounts,
    totals: [...totals]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, balanceMinor]) => ({ currency, balanceMinor })),
    categories: [...categories.values()].sort((a, b) =>
      a.amountMinor === b.amountMinor
        ? a.name.localeCompare(b.name)
        : a.amountMinor > b.amountMinor
          ? -1
          : 1,
    ),
    trends,
    recent: model.transactions
      .filter((row) => row.currency === currency && row.occurred_on >= from && row.occurred_on < to)
      .slice(0, 5),
  };
}
