import { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DatabaseZap } from 'lucide-react-native';
import { uuid } from 'expo';
import { getDatabase } from './connection.js';
import { createNotesRepository } from './repositories/notesRepository.js';
import { createNoteCategoriesRepository } from './repositories/noteCategoriesRepository.js';
import { createNotesService } from '../features/notes/services/notesService.js';
import { createTasksRepository } from './repositories/tasksRepository.js';
import { createTasksService } from '../features/tasks/services/tasksService.js';
import { createCalendarRepository } from './repositories/calendarRepository.js';
import { createCalendarService } from '../features/calendar/services/calendarService.js';
import { createMedicineRepository } from './repositories/medicineRepository.js';
import { createMedicineService } from '../features/medicine/services/medicineService.js';
import { createTimeTrackerRepository } from './repositories/timeTrackerRepository.js';
import { createTimeTrackerService } from '../features/timeTracker/services/timeTrackerService.js';
import { DatabaseError } from './errors.js';
import ScreenContainer from '../components/layout/ScreenContainer';
import AppText from '../components/ui/AppText';
import AppButton from '../components/ui/AppButton';
import EmptyState from '../components/ui/EmptyState';
import { colors, spacing } from '../theme';

/** @typedef {{notes: ReturnType<typeof createNotesRepository>, notesService: ReturnType<typeof createNotesService>, tasksService: ReturnType<typeof createTasksService>, calendarService: ReturnType<typeof createCalendarService>, medicineRepository: ReturnType<typeof createMedicineRepository>, medicineService: ReturnType<typeof createMedicineService>, timeTrackerService: ReturnType<typeof createTimeTrackerService>}} DatabaseServices */
const DatabaseContext = createContext(/** @type {DatabaseServices | null} */ (null));
/** @type {Promise<DatabaseServices> | null} */
let servicesPromise = null;

function loadServices() {
  if (!servicesPromise) {
    servicesPromise = getDatabase().then((db) => {
      const notes = createNotesRepository(db, uuid.v4);
      const tasks = createTasksRepository(db, uuid.v4);
      const medicineRepository = createMedicineRepository(db, uuid.v4);
      return { notes, notesService: createNotesService(notes, createNoteCategoriesRepository(db, uuid.v4)), tasksService: createTasksService(tasks), calendarService: createCalendarService(createCalendarRepository(db, uuid.v4), tasks), medicineRepository, medicineService:createMedicineService(medicineRepository), timeTrackerService:createTimeTrackerService(createTimeTrackerRepository(db,uuid.v4)) };
    }).catch((error) => {
      servicesPromise = null;
      throw error;
    });
  }
  return servicesPromise;
}

/** @param {{children: import('react').ReactNode}} props */
export default function DatabaseProvider({ children }) {
  const [services, setServices] = useState(/** @type {DatabaseServices | null} */ (null));
  const [error, setError] = useState(/** @type {Error | null} */ (null));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadServices().then((value) => { if (active) setServices(value); }).catch((failure) => {
      if (active) setError(failure instanceof Error ? failure : new Error('Local storage could not initialize.'));
    });
    return () => { active = false; };
  }, [attempt]);
  if (error) {
    return <ScreenContainer><EmptyState icon={DatabaseZap} title="Local storage is unavailable" description={error.message} action={error instanceof DatabaseError && error.code === 'ENCRYPTION_REQUIRED' ? undefined : <AppButton label="Try initialization again" onPress={() => { setError(null); setAttempt((value) => value + 1); }} />} /><AppText tone="muted">No database was deleted or reset. Development storage is for synthetic test data only.</AppText></ScreenContainer>;
  }
  if (!services) {
    return <ScreenContainer><View style={{ gap: spacing.lg, alignItems: 'center', padding: spacing.xxl }}><ActivityIndicator color={colors.primary} /><AppText>Preparing local storage…</AppText></View></ScreenContainer>;
  }
  return <DatabaseContext.Provider value={services}>{children}</DatabaseContext.Provider>;
}

export function useDatabase() {
  const services = useContext(DatabaseContext);
  if (!services) throw new DatabaseError('UNAVAILABLE', 'Database services are not initialized.');
  return services;
}
