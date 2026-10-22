import { DatabaseError } from '../../../database/errors.ts';
import { budgetReports } from './budgetMath.ts';
import {
  budgetName,
  nonnegativeMoney,
  validateAllocation,
  validateBudget,
} from '../validation/budgetInput.ts';
import { invalid } from '../../finance/validation/financeInput.ts';

export function createBudgetService(
  repository: ReturnType<
    typeof import('../../../database/repositories/budgetRepository.ts').createBudgetRepository
  >,
  clock: () => Date = () => new Date(),
) {
  const listeners: Set<() => void> = new Set();
  let busy = false;

  async function mutate<T>(action: () => Promise<T>) {
    if (busy) throw new DatabaseError('BUSY', 'A budget change is saving. Please wait.');
    busy = true;
    try {
      const result = await action();
      listeners.forEach((listener) => listener());
      return result;
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
    async overview() {
      const model = await repository.readModel();
      return { model, reports: budgetReports(model) };
    },

    create: (input: import('../validation/budgetInput.ts').BudgetInput) =>
      mutate(() => repository.create(validateBudget(input), clock().toISOString())),

    edit: (id: string, revision: number, name: string, archived: boolean) =>
      mutate(() => {
        if (typeof archived !== 'boolean') invalid('Invalid archive state.');
        return repository.edit(id, revision, budgetName(name), archived, clock().toISOString());
      }),

    adjustFunding: (id: string, revision: number, funding: string, reason: string) =>
      mutate(() => {
        if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500)
          invalid('Provide an adjustment reason of 1–500 characters.');
        return repository.adjustFunding(
          id,
          revision,
          nonnegativeMoney(funding),
          reason.trim(),
          clock().toISOString(),
        );
      }),

    saveAllocation: (
      id: string,
      revision: number,
      input: import('../validation/budgetInput.ts').AllocationInput,
    ) =>
      mutate(() =>
        repository.saveAllocation(id, revision, validateAllocation(input), clock().toISOString()),
      ),

    setLink: (
      id: string,
      revision: number,
      allocationId: string,
      transactionId: string,
      linked: boolean,
    ) =>
      mutate(() => {
        if (typeof linked !== 'boolean') invalid('Invalid link state.');
        return repository.setLink(
          id,
          revision,
          allocationId,
          transactionId,
          linked,
          clock().toISOString(),
        );
      }),
  };
}
