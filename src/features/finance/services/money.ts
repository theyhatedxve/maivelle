import { DatabaseError } from '../../../database/errors.ts';
export const MAX_MINOR = 999999999999;
export const currencies = ['PHP', 'USD', 'EUR'];
/** Parse decimal text using integer digit arithmetic; never parseFloat or multiply decimal money. */
export function parseMoney(value: unknown, signed: boolean = false) {
  if (
    typeof value !== 'string' ||
    !(signed ? /^-?\d{1,10}(?:\.\d{1,2})?$/ : /^\d{1,10}(?:\.\d{1,2})?$/).test(value.trim())
  )
    throw new DatabaseError(
      'VALIDATION',
      'Enter an amount with at most 10 whole digits and two decimal places, without commas or currency symbols.',
    );
  const raw = value.trim();
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = raw.replace('-', '').split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor > BigInt(MAX_MINOR) || (!signed && minor === 0n))
    throw new DatabaseError(
      'VALIDATION',
      'Amount must be positive and no more than 9,999,999,999.99. Opening balances may be zero or negative.',
    );
  return Number(negative ? -minor : minor);
}
/** Exact decimal text for editor fields. */
export function moneyInput(value: number | bigint) {
  const amount = BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}
/** Formatting BigInt avoids rounding large ledger totals through Number/Intl. */
export function formatMoney(value: number | bigint, currency: string = 'PHP') {
  const [whole, fraction] = moneyInput(value).split('.');
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}
/** Chart percentage only, never a financial source value. */
export function percentage(amount: bigint, total: bigint) {
  return total <= 0n ? 0 : Number((amount * 10000n) / total) / 100;
}
