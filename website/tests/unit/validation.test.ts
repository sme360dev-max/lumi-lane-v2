import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EMPTY_BOOKING,
  MESSAGES,
  parseDate,
  parseTime,
  validateBooking,
  venueToday,
} from '../../src/features/booking/validation.ts';

// 1 Jan 2030 09:00 in Adelaide (UTC+10:30 in summer) = 31 Dec 2029 22:30 UTC.
const NOW = new Date('2029-12-31T22:30:00Z');
const valid = {
  ...EMPTY_BOOKING,
  name: 'Sam Lee',
  email: 'sam@example.com',
  phone: '0400 000 000',
  guests: '4',
  date: '02/01/2030',
  time: '10:30 AM',
};

test('a complete form has no errors', () => assert.deepEqual(validateBooking(valid, NOW), {}));

test('empty form reports every required field with the original copy', () => {
  assert.deepEqual(validateBooking(EMPTY_BOOKING, NOW), {
    name: MESSAGES.name,
    email: MESSAGES.email,
    phone: MESSAGES.phone,
    guests: MESSAGES.guests,
    date: MESSAGES.date,
    time: MESSAGES.time,
  });
});

test('email, phone, guests formats', () => {
  assert.equal(validateBooking({ ...valid, email: 'sam@example' }, NOW).email, MESSAGES.email);
  assert.equal(validateBooking({ ...valid, phone: '1234' }, NOW).phone, MESSAGES.phone);
  assert.equal(validateBooking({ ...valid, phone: 'call me 0400000000' }, NOW).phone, MESSAGES.phone);
  assert.equal(validateBooking({ ...valid, phone: '+61 (0)400-000-000' }, NOW).phone, undefined);
  assert.equal(validateBooking({ ...valid, guests: 'four' }, NOW).guests, MESSAGES.guestsNumber);
  assert.equal(validateBooking({ ...valid, guests: '0' }, NOW).guests, MESSAGES.guestsNumber);
});

test('dates: original formats, impossible dates, past dates (venue timezone)', () => {
  assert.deepEqual(parseDate('24/08/2026'), { year: 2026, month: 8, day: 24 });
  assert.deepEqual(parseDate('24-8-26'), { year: 2026, month: 8, day: 24 });
  assert.deepEqual(parseDate('24.08.2026'), { year: 2026, month: 8, day: 24 });
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate('2026-08'), null);
  // Already 1 Jan 2030 in Adelaide even though it is still 31 Dec in UTC.
  assert.deepEqual(venueToday(NOW), { year: 2030, month: 1, day: 1 });
  assert.equal(validateBooking({ ...valid, date: '31/12/2029' }, NOW).date, MESSAGES.datePast);
  assert.equal(validateBooking({ ...valid, date: '01/01/2030' }, NOW).date, undefined);
});

test('times', () => {
  assert.deepEqual(parseTime('10:30 AM'), { hours: 10, minutes: 30 });
  assert.deepEqual(parseTime('12:15pm'), { hours: 12, minutes: 15 });
  assert.deepEqual(parseTime('12am'), { hours: 0, minutes: 0 });
  assert.deepEqual(parseTime('14:05'), { hours: 14, minutes: 5 });
  assert.deepEqual(parseTime('1030'), { hours: 10, minutes: 30 });
  assert.equal(parseTime('9'), null);
  assert.equal(parseTime('25:00'), null);
  assert.equal(parseTime('13pm'), null);
  assert.equal(validateBooking({ ...valid, time: 'lunch' }, NOW).time, MESSAGES.timeFormat);
});
