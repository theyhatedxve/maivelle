// Presentation metadata and samples. Tasks/Notes values are replaced by SQLite summaries.
export const dashboardData = {
  greeting: 'Hello, welcome to Maivelle',
  headline: 'A little clarity.\nA lighter day.',
  description: 'Your plans, wellbeing, and everyday essentials, together in one place.',
  dateLabel: 'Sunday, 18 October · Sample day',
  modules: [
    { id: 'tasks', title: 'Tasks', value: '…', detail: 'incomplete tasks', href: '/tasks' },
    { id: 'calendar', title: 'Calendar', value: '…', detail: 'events in the next 30 days', href: '/calendar' },
    { id: 'finance', title: 'Finance', value: '$128', detail: 'spent this week', href: '/finance' },
    { id: 'notes', title: 'Notes', value: '…', detail: 'active notes on device', href: '/notes' },
    { id: 'medicine', title: 'Medicine', value: '1', detail: 'reminder today', href: '/medicine' },
    { id: 'timer', title: 'Timer', value: '25 min', detail: 'for your next focus', href: '/timer' },
    { id: 'vault', title: 'Vault', value: '4', detail: 'sample items', href: '/vault' },
    { id: 'budget', title: 'Budget', value: '$372', detail: 'left in sample plan', href: '/budget' },
  ],
  quickActions: [
    { id: 'tasks', label: 'Plan a task', href: '/tasks' },
    { id: 'notes', label: 'Capture an idea', href: '/notes' },
    { id: 'timer', label: 'Find your focus', href: '/timer' },
    { id: 'finance', label: 'Review spending', href: '/finance' },
  ],
  upcomingItems: [
    { id: 'weekly-plan', module: 'tasks', title: 'Plan the week ahead', time: 'Today · 9:00 AM', href: '/tasks' },
    { id: 'check-in', module: 'calendar', title: 'An afternoon check-in', time: 'Today · 2:30 PM', href: '/calendar' },
    { id: 'wellbeing', module: 'medicine', title: 'Wellbeing reminder', time: 'Today · 6:00 PM', href: '/medicine' },
  ],
};
