import { CalendarDays, CheckSquare, FileText, Hourglass, Pill, ShieldCheck, Wallet, PiggyBank } from 'lucide-react-native';

/** @type {Record<string, import('lucide-react-native').LucideIcon>} */
export const moduleIcons = {
  tasks: CheckSquare, calendar: CalendarDays, finance: Wallet, notes: FileText,
  medicine: Pill, timer: Hourglass, vault: ShieldCheck, budget: PiggyBank,
};
