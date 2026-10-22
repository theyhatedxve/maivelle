import {
  CalendarDays,
  CheckSquare,
  FileText,
  Hourglass,
  Pill,
  ShieldCheck,
  Wallet,
  PiggyBank,
} from 'lucide-react-native';

export const moduleIcons: Record<string, import('lucide-react-native').LucideIcon> = {
  tasks: CheckSquare,
  calendar: CalendarDays,
  finance: Wallet,
  notes: FileText,
  medicine: Pill,
  timer: Hourglass,
  vault: ShieldCheck,
  budget: PiggyBank,
};
