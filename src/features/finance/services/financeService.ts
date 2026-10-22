import { DatabaseError } from '../../../database/errors.ts';
import { currencies } from './money.ts';
import { financialToday, financeReport } from './financeLedger.ts';
import {
  financeDate,
  financeId,
  invalid,
  validateAccount,
  validateCategory,
  validateTransaction,
} from '../validation/financeInput.ts';

export function createFinanceService(
  repository: ReturnType<
    typeof import('../../../database/repositories/financeRepository.ts').createFinanceRepository
  >,
  clock: () => Date = () => new Date(),
) {
  const listeners: Set<() => void> = new Set();
  let busy = false;

  async function mutate<T>(action: () => Promise<T>) {
    if (busy) throw new DatabaseError('BUSY', 'A financial change is saving. Please wait.');
    busy = true;
    try {
      const value = await action();
      listeners.forEach((listener) => listener());
      return value;
    } finally {
      busy = false;
    }
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    newTransactionId: () => repository.newTransactionId(),
    accounts: () => repository.accounts(),
    categories: () => repository.categories(),
    getAccount: async (id: string) => repository.getAccount(financeId(id)),
    getTransaction: async (id: string) => repository.getTransaction(financeId(id)),

    saveAccount: (
      id: string | null,
      revision: number | null,
      input: import('../validation/financeInput.ts').AccountInput,
    ) =>
      mutate(() =>
        repository.saveAccount(id, revision, validateAccount(input), clock().toISOString()),
      ),

    archiveAccount: (
      account: import('../../../database/repositories/financeRepository.ts').FinancialAccount,
      archived: boolean,
    ) =>
      mutate(() => {
        if (typeof archived !== 'boolean') invalid('Invalid account archive state.');
        return repository.saveAccount(
          account.id,
          account.revision,
          {
            name: account.name,
            type: account.type,
            currency: account.currency,
            openingMinor: account.opening_minor,
            archived,
          },
          clock().toISOString(),
        );
      }),

    saveCategory: (
      id: string | null,
      revision: number | null,
      input: import('../validation/financeInput.ts').CategoryInput,
    ) =>
      mutate(() =>
        repository.saveCategory(id, revision, validateCategory(input), clock().toISOString()),
      ),

    deleteCategory: (
      category: import('../../../database/repositories/financeRepository.ts').FinancialCategory,
    ) =>
      mutate(() =>
        repository.deleteCategory(category.id, category.revision, clock().toISOString()),
      ),

    saveTransaction: (
      id: string | null,
      revision: number | null,
      submissionId: string,
      input: import('../validation/financeInput.ts').TransactionInput,
    ) =>
      mutate(() => {
        const value = validateTransaction(input);
        if (value.date > financialToday(clock()))
          invalid('Future-dated entries are not supported. Choose today or an earlier date.');
        return repository.saveTransaction(id, revision, submissionId, value, clock().toISOString());
      }),

    deleteTransaction: (
      record: import('../../../database/repositories/financeRepository.ts').FinancialTransaction,
    ) => mutate(() => repository.deleteTransaction(record.id, record.revision)),

    async history(
      options: import('../../../database/repositories/financeRepository.ts').FinanceQuery = {},
    ) {
      const from = financeDate(options.from ?? '1900-01-01');
      const to = financeDate(options.to ?? '9998-12-31');
      if (to < from) invalid('Range end must be on or after its start.');
      return repository.history({ ...options, from, to });
    },

    async report(month: string = financialToday(clock()).slice(0, 7), currency: string = 'PHP') {
      if (!currencies.includes(currency)) invalid('Choose PHP, USD or EUR.');
      return financeReport(await repository.readModel(), month, currency);
    },
  };
}
