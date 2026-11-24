import { expect, test } from '@playwright/test';
import { formatDate, prettyDate, venueToday } from '../../src/features/booking/validation';
import { API_ORIGIN, mockBackend } from './support/backend';

const REQUIRED_MESSAGES = [
  'Please tell us your name.',
  'Enter a valid email address.',
  'Enter a contact number.',
  'How many are joining us?',
  'Add a date, for example 24/08/2026.',
  'Let us know a time.',
];

const BOOKINGS = `${API_ORIGIN}/api/bookings/`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// The venue API's own replies (backend/bookings/views.py).
const TOO_MANY_GUESTS = 'Enter between 1 and 30 guests. For larger groups, please call us.';
const RECEIVED = 'Thank you. Your table request has been sent; the team will contact you to confirm.';

interface Attempt {
  url: string;
  authorization: string | undefined;
  body: Record<string, string>;
}

test('booking: validation errors, focus, and a table request sent to the venue API', async ({ page }, info) => {
  // Every data submission the page makes, including ones that never reach the API.
  const attempts: Attempt[] = [];
  page.on('request', (request) => {
    // Next.js may HEAD/GET-prefetch links; only a data submission (POST/PUT/PATCH) means "sent".
    if (!['POST', 'PUT', 'PATCH'].includes(request.method())) return;
    attempts.push({
      url: request.url(),
      authorization: request.headers()['authorization'],
      body: request.postDataJSON() as Record<string, string>,
    });
  });
  let outage = false;
  await mockBackend(page, {
    'POST /api/bookings/': (request) => {
      const body = request.postDataJSON() as Record<string, string>;
      if (Number(body.guests) > 30) {
        return { status: 400, body: { error: 'Please check the highlighted details.', errors: { guests: TOO_MANY_GUESTS } } };
      }
      if (outage) return { status: 503 };
      return { status: 201, body: { message: RECEIVED, requestId: body.requestId } };
    },
  });

  await page.goto('/book/');
  const main = page.getByRole('main');
  const form = main.getByRole('form', { name: 'Table request' });
  const guests = page.getByLabel('Guests', { exact: true });
  const date = page.getByLabel('Date', { exact: true });
  const time = page.getByLabel('Preferred time', { exact: true });
  const submit = form.getByRole('button', { name: 'Send table request' });
  const alert = form.getByRole('alert');
  const summary = page.getByTestId('booking-summary');
  await expect(main.getByRole('heading', { level: 1, name: 'Reserve Your Table.' })).toBeVisible();
  await expect(form).toHaveAccessibleDescription('Send a table request. The venue team will contact you to confirm.');
  await expect(main.getByRole('link', { name: 'Call 0405 555 442' })).toHaveAttribute('href', 'tel:0405555442');
  await expect(main.getByText('Listed phone number. Confirm directly with Lumi Lane.')).toHaveCount(1);
  await expect(date).toHaveAttribute('placeholder', 'DD/MM/YYYY');
  await page.getByRole('button', { name: 'Open calendar' }).click();
  const calendar = page.getByRole('dialog', { name: 'Choose a date' });
  await expect(calendar.getByRole('button', { name: 'Previous month' })).toBeDisabled();
  if (info.project.name === 'mobile-390') {
    await page.screenshot({ path: 'qa/premium/book-calendar-390.png', scale: 'css', animations: 'disabled' });
  }
  await calendar.getByRole('button', { name: prettyDate(venueToday()), exact: true }).click();
  await expect(date).toHaveValue(formatDate(venueToday()));
  await date.fill('');
  await expect(guests).toHaveValue('2');
  await page.getByRole('button', { name: 'Add one guest' }).click();
  await expect(guests).toHaveValue('3');
  await page.getByRole('button', { name: 'Remove one guest' }).click();
  await expect(guests).toHaveValue('2');
  await guests.fill('');
  await submit.click();
  await expect(guests).toBeFocused();
  await expect(guests).toHaveAttribute('aria-invalid', 'true');
  await expect(guests).toHaveAccessibleDescription('How many are joining us?');
  for (const msg of REQUIRED_MESSAGES) await expect(page.getByText(msg)).toBeVisible();

  await page.getByLabel('Name').fill('Sam Lee');
  await expect(page.getByText('Please tell us your name.')).toBeHidden();
  await page.getByLabel('Email').fill('sam@example');
  await page.getByLabel('Phone').fill('0400 000 000');
  await guests.fill('4');
  await date.fill('01/01/2020');
  await submit.click();
  await expect(date).toBeFocused();
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Choose today or a later date.')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  await expect(alert).toHaveCount(0);
  expect(attempts).toEqual([]); // an invalid form is never submitted anywhere

  // A request the browser accepts but the venue does not: its field message lands on the field.
  const year = new Date().getFullYear() + 1;
  await page.getByLabel('Email').fill('sam@example.com');
  await date.fill(`24/08/${year}`);
  await time.fill('10:30');
  await page.getByLabel('Special Requests').fill('  High chair please ');
  await guests.fill('40');
  await submit.click();
  await expect(alert).toHaveText('Please check the highlighted details.');
  await expect(guests).toHaveAttribute('aria-invalid', 'true');
  await expect(guests).toHaveAccessibleDescription(TOO_MANY_GUESTS);
  await expect(submit).toBeEnabled();
  await expect(summary).toHaveCount(0);
  const details = {
    name: 'Sam Lee',
    email: 'sam@example.com',
    phone: '0400 000 000',
    date: `${year}-08-24`,
    time: '10:30',
    notes: 'High chair please',
  };
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toEqual({
    url: BOOKINGS,
    authorization: undefined, // a guest request carries no account token
    body: { requestId: expect.stringMatching(UUID), ...details, guests: '40' },
  });

  // The API cannot be reached: the visitor is told, and nothing they typed is lost.
  await guests.fill('4');
  await expect(guests).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(TOO_MANY_GUESTS)).toBeHidden();
  await page.route(BOOKINGS, (route) => route.abort('connectionrefused'));
  await submit.click();
  // The wording here is currently the browser's own ("Failed to fetch"), so only its presence is pinned.
  await expect(alert).toBeVisible();
  await expect(alert).not.toHaveText('Please check the highlighted details.');
  await expect(alert).not.toBeEmpty();
  await expect(submit).toBeEnabled();
  await expect(summary).toHaveCount(0);
  await expect(page.getByLabel('Name')).toHaveValue('Sam Lee');
  await expect(guests).toHaveValue('4');
  await page.unroute(BOOKINGS);

  // The API answers with an error and no explanation: the page supplies its own.
  outage = true;
  await submit.click();
  await expect(alert).toHaveText('We could not send your request. Please try again or call the venue.');
  await expect(summary).toHaveCount(0);

  outage = false;
  await submit.click();
  await expect(summary.getByRole('heading', { level: 1, name: 'Request received.' })).toBeFocused();
  await expect(summary.getByRole('status')).toHaveText(
    'Your table request has been sent. The team will contact you to confirm your reservation.',
  );
  await expect(summary).toContainText('Sam Lee');
  await expect(summary).toContainText(`${prettyDate({ year, month: 8, day: 24 })}, 10:30 AM (Adelaide time)`);
  await expect(summary).toContainText('sam@example.com · 0400 000 000');
  await expect(summary).toContainText('High chair please');
  // It is a request for the team to answer, never a confirmed reservation with a reference.
  await expect(summary).not.toContainText(/confirmed|reference/i);
  await expect(summary.getByRole('link', { name: 'Call 0405 555 442' })).toHaveAttribute('href', 'tel:0405555442');
  await expect(form).toHaveCount(0);

  // Four submissions in all, each to the bookings endpoint. The three tries at the same details
  // share one request id, so a retry can never create a second booking.
  expect(attempts).toHaveLength(4);
  for (const attempt of attempts) expect(attempt.url).toBe(BOOKINGS);
  expect(attempts[1]!.body).toEqual({ requestId: expect.stringMatching(UUID), ...details, guests: '4' });
  expect(attempts[1]!.body.requestId).not.toBe(attempts[0]!.body.requestId);
  expect(attempts[2]).toEqual(attempts[1]);
  expect(attempts[3]).toEqual(attempts[1]);

  await summary.getByRole('button', { name: 'Edit details' }).click();
  await expect(page.getByLabel('Name')).toBeFocused();
  await expect(page.getByLabel('Name')).toHaveValue('Sam Lee');
  await expect(guests).toHaveValue('4');
  expect(attempts).toHaveLength(4); // going back to edit sends nothing
});
