import { financeDate, financeId, invalid } from '../../finance/validation/financeInput.ts';
import { currencies, parseMoney } from '../../finance/services/money.ts';
export type BudgetInput = {
  name: string;
  currency: string;
  from: string;
  to: string;
  accountIds: string[];
  funding: string;
};
export type AllocationInput = {
  id: string | null;
  categoryKey: string;
  mode: string;
  value: string;
};

export function budgetName(value: string) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120)
    invalid('Budget name must contain 1–120 characters.');
  return value.trim();
}

export function nonnegativeMoney(text: string) {
  const amount = parseMoney(text, true);
  if (amount < 0) invalid('Amounts cannot be negative.');
  return amount;
}

export function validateBudget(input: BudgetInput) {
  const name = budgetName(input.name);
  if (!currencies.includes(input.currency)) invalid('Choose PHP, USD or EUR.');
  const from = financeDate(input.from),
    to = financeDate(input.to);
  if (to < from) invalid('Period end must be on or after its start.');
  if (
    !Array.isArray(input.accountIds) ||
    !input.accountIds.length ||
    input.accountIds.length > 100 ||
    new Set(input.accountIds).size !== input.accountIds.length
  )
    invalid('Choose 1–100 distinct funding accounts.');
  const accountIds = input.accountIds.map(financeId).sort();
  return {
    name,
    currency: input.currency,
    from,
    to,
    accountIds,
    funding: nonnegativeMoney(input.funding),
  };
}

export function validateAllocation(input: AllocationInput) {
  const categoryKey = financeId(input.categoryKey);
  if (!['fixed', 'percent'].includes(input.mode)) invalid('Choose fixed amount or percentage.');
  let value;
  if (input.mode === 'fixed') value = nonnegativeMoney(input.value);
  else {
    if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(input.value.trim()))
      invalid('Percentage must be 0–100 with at most two decimal places.');
    const [whole, fraction = ''] = input.value.trim().split('.');
    value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (value > 10000) invalid('Percentage cannot exceed 100%.');
  }
  return {
    id: input.id === null ? null : financeId(input.id),
    categoryKey,
    mode: input.mode,
    value,
  };
}
