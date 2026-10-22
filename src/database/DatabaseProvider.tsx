import { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DatabaseZap } from 'lucide-react-native';
import { uuid } from 'expo';
import { getDatabase, closeDatabase, storageControl, getStorage } from './connection.ts';
import { guardDatabase, pauseStorageConsumers } from './storage/maintenance.ts';
import { cutoverDatabase } from './storage/cutover.ts';
import { integrity } from '../features/settings/services/backupValidation.ts';
import { createSettingsRepository } from './repositories/settingsRepository.ts';
import { vaultBiometrics } from '../services/security/vaultBiometrics.native.ts';
import { createNotesRepository } from './repositories/notesRepository.ts';
import { createNoteCategoriesRepository } from './repositories/noteCategoriesRepository.ts';
import { createNotesService } from '../features/notes/services/notesService.ts';
import { createTasksRepository } from './repositories/tasksRepository.ts';
import { createTasksService } from '../features/tasks/services/tasksService.ts';
import { createCalendarRepository } from './repositories/calendarRepository.ts';
import { createCalendarService } from '../features/calendar/services/calendarService.ts';
import { createMedicineRepository } from './repositories/medicineRepository.ts';
import { createMedicineService } from '../features/medicine/services/medicineService.ts';
import { createTimeTrackerRepository } from './repositories/timeTrackerRepository.ts';
import { createTimeTrackerService } from '../features/timeTracker/services/timeTrackerService.ts';
import { createFinanceRepository } from './repositories/financeRepository.ts';
import { createFinanceService } from '../features/finance/services/financeService.ts';
import { createBudgetRepository } from './repositories/budgetRepository.ts';
import { createBudgetService } from '../features/budget/services/budgetService.ts';
import { createVaultRepository } from './repositories/vaultRepository.ts';
import { DatabaseError } from './errors.ts';
import ScreenContainer from '../components/layout/ScreenContainer.tsx';
import AppText from '../components/ui/AppText.tsx';
import AppButton from '../components/ui/AppButton.tsx';
import EmptyState from '../components/ui/EmptyState.tsx';
import { colors, spacing } from '../theme/index.ts';

export type DatabaseProviderProps = {
  children: import('react').ReactNode;
};

export type DatabaseServices = {
  settingsRepository: ReturnType<typeof createSettingsRepository>;
  replaceDatabase: (name: string) => Promise<void>;
  vaultRepository: ReturnType<typeof createVaultRepository>;
  notes: ReturnType<typeof createNotesRepository>;
  notesService: ReturnType<typeof createNotesService>;
  tasksService: ReturnType<typeof createTasksService>;
  calendarService: ReturnType<typeof createCalendarService>;
  medicineRepository: ReturnType<typeof createMedicineRepository>;
  medicineService: ReturnType<typeof createMedicineService>;
  timeTrackerService: ReturnType<typeof createTimeTrackerService>;
  financeService: ReturnType<typeof createFinanceService>;
  budgetService: ReturnType<typeof createBudgetService>;
};

const DatabaseContext = createContext(null as DatabaseServices | null);

let servicesPromise: Promise<DatabaseServices> | null = null;

let guarded: ReturnType<typeof guardDatabase> | null = null;

let replaceHandler: ((name: string) => Promise<void>) | null = null;
let replacementRunning = false;
function loadServices() {
  if (!servicesPromise) {
    servicesPromise = getDatabase()
      .then((raw) => {
        guarded = guardDatabase(raw);
        const db = guarded.db;
        const notes = createNotesRepository(db, uuid.v4);
        const tasks = createTasksRepository(db, uuid.v4);
        const medicineRepository = createMedicineRepository(db, uuid.v4);
        return {
          settingsRepository: createSettingsRepository(db),
          replaceDatabase: async (name: string) => {
            if (!replaceHandler) throw new Error('Storage owner is unavailable.');
            await replaceHandler(name);
          },
          vaultRepository: createVaultRepository(db),
          notes,
          notesService: createNotesService(notes, createNoteCategoriesRepository(db, uuid.v4)),
          tasksService: createTasksService(tasks),
          calendarService: createCalendarService(createCalendarRepository(db, uuid.v4), tasks),
          medicineRepository,
          medicineService: createMedicineService(medicineRepository),
          timeTrackerService: createTimeTrackerService(createTimeTrackerRepository(db, uuid.v4)),
          financeService: createFinanceService(createFinanceRepository(db, uuid.v4)),
          budgetService: createBudgetService(createBudgetRepository(db, uuid.v4)),
        };
      })
      .catch((error) => {
        servicesPromise = null;
        throw error;
      });
  }
  return servicesPromise;
}

export default function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [services, setServices] = useState(null as DatabaseServices | null);
  const [error, setError] = useState(null as Error | null);
  const [attempt, setAttempt] = useState(0);
  const [maintenance, setMaintenance] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    replaceHandler = async (name) => {
      if (replacementRunning) throw new Error('Storage replacement is already running.');
      replacementRunning = true;
      try {
        await pauseStorageConsumers();
        setMaintenance(true);
        await guarded?.retire();
        const storage = await getStorage();
        if (storage.owner) await storage.owner.activate(name);
        else
          await cutoverDatabase(
            {
              control: await storageControl(),
              close: closeDatabase,
              open: getDatabase,
              verify: async () => integrity(await getDatabase()),
            },
            name,
          );
        // Authorization shortcuts are device-local and must not survive replacement.
        await vaultBiometrics.remove();
        setNotice(
          'Restore completed. Previous data is retained as a local recovery point. Review notification permissions; reminders are being rebuilt. Re-enable app lock on this device if desired.',
        );
      } catch (failure) {
        setNotice(
          failure instanceof Error
            ? failure.message
            : 'Storage replacement failed. No data was reset.',
        );
        throw failure;
      } finally {
        servicesPromise = null;
        guarded = null;
        replacementRunning = false;
        setServices(null);
        setMaintenance(false);
        setAttempt((n) => n + 1);
      }
    };
    return () => {
      replaceHandler = null;
    };
  }, []);
  useEffect(() => {
    let active = true;
    loadServices()
      .then((value) => {
        if (active) setServices(value);
      })
      .catch((failure) => {
        if (active)
          setError(
            failure instanceof Error ? failure : new Error('Local storage could not initialize.'),
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (maintenance)
    return (
      <ScreenContainer>
        <AppText>Reopening verified local storage...</AppText>
        <AppText tone="muted">
          Keep Maivelle open. The previous database is retained; interrupted cutover rolls back on
          restart.
        </AppText>
      </ScreenContainer>
    );
  if (error) {
    return (
      <ScreenContainer>
        <EmptyState
          icon={DatabaseZap}
          title="Local storage is unavailable"
          description={error.message}
          action={
            error instanceof DatabaseError && error.code === 'ENCRYPTION_REQUIRED' ? undefined : (
              <AppButton
                label="Try initialization again"
                onPress={() => {
                  setError(null);
                  setAttempt((value) => value + 1);
                }}
              />
            )
          }
        />
        <AppText tone="muted">
          No database was deleted or reset. Development storage is for synthetic test data only.
        </AppText>
      </ScreenContainer>
    );
  }
  if (!services) {
    return (
      <ScreenContainer>
        <View
          style={{
            gap: spacing.lg,
            alignItems: 'center',
            padding: spacing.xxl,
          }}
        >
          <ActivityIndicator color={colors.primary} />
          <AppText>Preparing local storage…</AppText>
        </View>
      </ScreenContainer>
    );
  }
  return (
    <DatabaseContext.Provider value={services}>
      {notice ? (
        <View style={{ padding: spacing.sm, backgroundColor: colors.lavender }}>
          <AppText variant="caption">{notice}</AppText>
          <AppButton
            label="Dismiss storage message"
            variant="secondary"
            onPress={() => setNotice('')}
          />
        </View>
      ) : null}
      {children}
    </DatabaseContext.Provider>
  );
}
export function useDatabase() {
  const services = useContext(DatabaseContext);
  if (!services) throw new DatabaseError('UNAVAILABLE', 'Database services are not initialized.');
  return services;
}
