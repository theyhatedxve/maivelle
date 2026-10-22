import { addDays, civilDate, localToday, validateDate } from '../services/calendarDates.ts';
export type EventForm = ReturnType<typeof blankEventForm>;

export function blankEventForm(date: string = localToday()) {
  return {
    title: '',
    description: '',
    location: '',
    startDate: date,
    startTime: '09:00',
    endDate: date,
    endTime: '10:00',
    allDay: false,
    categoryId: null as string | null,
    reminderMinutes: null as number | null,
    frequency: 'none',
    interval: '1',
    weekdays: [civilDate(date).getUTCDay()],
    until: '',
    count: '',
  };
}

export function eventToForm(
  event: import('../../../database/repositories/calendarRepository.ts').CalendarEvent,
) {
  return {
    title: event.title,
    description: event.description,
    location: event.location,
    startDate: event.startLocal.slice(0, 10),
    startTime: event.startLocal.slice(11),
    endDate: event.allDay ? addDays(event.endLocal.slice(0, 10), -1) : event.endLocal.slice(0, 10),
    endTime: event.endLocal.slice(11),
    allDay: event.allDay,
    categoryId: event.categoryId,
    reminderMinutes: event.reminderMinutes ?? null,
    frequency: event.recurrence?.frequency ?? 'none',
    interval: String(event.recurrence?.interval ?? 1),
    weekdays: event.recurrence?.weekdays ?? [civilDate(event.startLocal.slice(0, 10)).getUTCDay()],
    until: event.recurrence?.until ?? '',
    count: event.recurrence?.count ? String(event.recurrence.count) : '',
  };
}

export function formToEvent(form: EventForm) {
  validateDate(form.startDate);
  validateDate(form.endDate);
  return {
    title: form.title,
    description: form.description,
    location: form.location,
    startLocal: `${form.startDate}T${form.allDay ? '00:00' : form.startTime}`,
    endLocal: `${form.allDay ? addDays(form.endDate, 1) : form.endDate}T${form.allDay ? '00:00' : form.endTime}`,
    allDay: form.allDay,
    categoryId: form.categoryId,
    reminderMinutes: form.reminderMinutes,
  };
}

export function formToRule(form: EventForm) {
  return form.frequency === 'none'
    ? null
    : {
        frequency: form.frequency,
        interval: Number(form.interval),
        weekdays: form.weekdays,
        until: form.until || null,
        count: form.count === '' ? null : Number(form.count),
      };
}
