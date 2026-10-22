import { Heart, Layers, LockKeyhole } from 'lucide-react-native';

export const welcomeValues = [
  { title: 'Private', description: 'Your data stays\non your device.', icon: LockKeyhole },
  { title: 'Personal', description: 'Organize what\nmatters to you.', icon: Layers },
  { title: 'Local', description: 'Made for your\neveryday life.', icon: Heart },
] as const;

export const welcomePages = [
  {
    title: 'Everything You Value,\nin One Place.',
    description: '',
  },
  {
    title: 'A little more space\nfor what matters.',
    description:
      'Your notes, tasks, calendar, medicine reminders, time, finances, budgets and Vault. Eight spaces, one personal home.',
  },
  {
    title: 'Your everyday.\nOn your terms.',
    description:
      'No online account to create. No cloud service to depend on. Your records work offline, and you choose when to save an encrypted backup.',
  },
] as const;
