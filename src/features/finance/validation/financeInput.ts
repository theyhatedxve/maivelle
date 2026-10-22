import { DatabaseError } from '../../../database/errors.ts';
import { currencies, parseMoney } from '../services/money.ts';
export type AccountInput = {
  name: string;
  type: string;
  currency: string;
  opening: string;
  archived: boolean;
};
export type CategoryInput = {
  name: string;
  kind: string;
  color: string;
};
export type TransactionInput = {
  type: string;
  amount: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  description: string;
  date: string;
};

export function invalid(message: string): never {
  throw new DatabaseError('VALIDATION', message);
}

export function financeId(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value))
    invalid('Invalid financial record identifier.');
  return value;
}

function text(value: unknown, max: number, label: string, required: boolean = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    invalid(`${label} must ${required ? 'contain text and ' : ''}be at most ${max} characters.`);
  return value.trim();
}
/** Finance dates are civil dates, not UTC instants. */
export function financeDate(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\d$/.test(value) ||
    value < '1900-01-01' ||
    value > '9998-12-31'
  )
    invalid('Use a valid date in YYYY-MM-DD format (1900–9998).');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    invalid('Choose a real calendar date.');
  return value;
}

export function validateAccount(input: AccountInput) {
  if (!input || typeof input !== 'object') invalid('Provide account details.');
  const name = text(input.name, 120, 'Account name');
  if (
    !['cash', 'bank', 'ewallet', 'other'].includes(input.type) ||
    !currencies.includes(input.currency) ||
    typeof input.archived !== 'boolean'
  )
    invalid('Choose a supported account type, currency and archive state.');
  return {
    name,
    type: input.type,
    currency: input.currency,
    openingMinor: parseMoney(input.opening, true),
    archived: input.archived,
  };
}

export function validateCategory(input: CategoryInput) {
  if (!input || typeof input !== 'object') invalid('Provide category details.');
  const name = text(input.name, 120, 'Category name');
  if (
    !['income', 'expense'].includes(input.kind) ||
    typeof input.color !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(input.color)
  )
    invalid('Choose income or expense and a valid #RRGGBB category color.');
  return { name, kind: input.kind, color: input.color };
}

export function validateTransaction(input: TransactionInput) {
  if (!input || typeof input !== 'object') invalid('Provide transaction details.');
  if (!['income', 'expense', 'transfer'].includes(input.type))
    invalid('Choose income, expense or transfer.');
  const accountId = financeId(input.accountId);
  const toAccountId = input.toAccountId === null ? null : financeId(input.toAccountId);
  const categoryId = input.categoryId === null ? null : financeId(input.categoryId);
  if (input.type === 'transfer' && (!toAccountId || toAccountId === accountId || categoryId))
    invalid('Transfers need two different accounts and no category.');
  if (input.type !== 'transfer' && toAccountId)
    invalid('Only transfers have a destination account.');
  return {
    type: input.type,
    amountMinor: parseMoney(input.amount),
    accountId,
    toAccountId,
    categoryId,
    description: text(input.description, 2000, 'Description', false),
    date: financeDate(input.date),
  };
}
