// Client-side validation for the Book a Table form. Pure functions (no DOM), unit-tested in tests/unit.
// Dates are interpreted as calendar dates in the venue's timezone (Australia/Adelaide), never the
// visitor's browser timezone.

export const VENUE_TIMEZONE = 'Australia/Adelaide';

export interface BookingValues {
  name: string;
  email: string;
  phone: string;
  guests: string;
  date: string;
  time: string;
  notes: string;
}

export type BookingField = keyof BookingValues;
export type BookingErrors = Partial<Record<BookingField, string>>;

export const EMPTY_BOOKING: BookingValues = {
  name: '',
  email: '',
  phone: '',
  guests: '',
  date: '',
  time: '',
  notes: '',
};

/** Error copy from the original prototype, plus messages for the stricter checks. */
export const MESSAGES = {
  name: 'Please tell us your name.',
  email: 'Enter a valid email address.',
  phone: 'Enter a contact number.',
  guests: 'How many are joining us?',
  guestsNumber: 'Enter the number of guests, for example 4.',
  date: 'Add a date, for example 24/08/2026.',
  datePast: 'Choose today or a later date.',
  time: 'Let us know a time.',
  timeFormat: 'Enter a time such as 10:30 AM.',
} as const;

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Accepts 24/08/2026, 24-8-26, 24.08.2026 (as the original form did). */
export function parseDate(value: string): CalendarDate | null {
  const parts = value.trim().split(/[/\-.\s]+/);
  if (parts.length !== 3) return null;
  const [d, m, rawY] = parts.map(Number) as [number, number, number];
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(rawY) || !d || !m || !rawY) return null;
  const y = rawY < 100 ? rawY + 2000 : rawY;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { year: y, month: m, day: d };
}

/** Today's calendar date at the venue. */
export function venueToday(now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: VENUE_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export const dateKey = (d: CalendarDate) => d.year * 10000 + d.month * 100 + d.day;

export const formatDate = (d: CalendarDate) =>
  `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`;

/** "Saturday 24 August" style label, computed without any timezone shift. */
export function prettyDate(d: CalendarDate): string {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export interface ClockTime {
  hours: number; // 0-23
  minutes: number;
}

/** Accepts "10:30 AM", "10.30am", "1030", "14:15", "9am". */
export function parseTime(value: string): ClockTime | null {
  const m = value
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?:[:.]?(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = m[2] ? Number(m[2]) : 0;
  const mer = m[3]?.[0];
  if (minutes > 59) return null;
  if (mer) {
    if (hours < 1 || hours > 12) return null;
    if (mer === 'p' && hours !== 12) hours += 12;
    if (mer === 'a' && hours === 12) hours = 0;
  } else if (hours > 23 || (!m[2] && hours > 12)) {
    return null;
  } else if (!m[2]) {
    return null; // a bare "9" is ambiguous
  }
  return { hours, minutes };
}

export const formatTime = ({ hours, minutes }: ClockTime) => {
  const h12 = hours % 12 || 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const digitCount = (v: string) => (v.match(/\d/g) ?? []).length;

export function validateBooking(values: BookingValues, now: Date = new Date()): BookingErrors {
  const errors: BookingErrors = {};
  if (!values.name.trim()) errors.name = MESSAGES.name;
  if (!EMAIL.test(values.email.trim())) errors.email = MESSAGES.email;
  if (digitCount(values.phone) < 8 || /[^\d\s()+-]/.test(values.phone.trim())) errors.phone = MESSAGES.phone;

  const guests = values.guests.trim();
  if (!guests) errors.guests = MESSAGES.guests;
  else if (!/^\d+$/.test(guests) || !Number.isSafeInteger(Number(guests)) || Number(guests) < 1)
    errors.guests = MESSAGES.guestsNumber;

  const date = parseDate(values.date);
  if (!date) errors.date = MESSAGES.date;
  else if (dateKey(date) < dateKey(venueToday(now))) errors.date = MESSAGES.datePast;

  if (!values.time.trim()) errors.time = MESSAGES.time;
  else if (!parseTime(values.time)) errors.time = MESSAGES.timeFormat;

  return errors;
}

/** Order used to move focus to the first invalid field. */
export const FIELD_ORDER: BookingField[] = ['guests', 'date', 'time', 'name', 'email', 'phone', 'notes'];
