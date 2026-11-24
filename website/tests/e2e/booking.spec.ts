import { expect, test } from '@playwright/test';
import { formatDate, prettyDate, venueToday } from '../../src/features/booking/validation';

const REQUIRED_MESSAGES = [
  'Please tell us your name.',
  'Enter a valid email address.',
  'Enter a contact number.',
  'How many are joining us?',
  'Add a date, for example 24/08/2026.',
  'Let us know a time.',
];

test('booking: validation errors, focus, and an honest (not sent) summary', async ({ page }, info) => {
  await page.goto('/book/');
  const guests = page.getByLabel('Guests', { exact: true });
  const date = page.getByLabel('Date', { exact: true });
  const time = page.getByLabel('Preferred time', { exact: true });
  const submit = page.getByRole('button', { name: 'Review request' });
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
  for (const msg of REQUIRED_MESSAGES) await expect(page.getByText(msg)).toBeVisible();

  await page.getByLabel('Name').fill('Sam Lee');
  await expect(page.getByText('Please tell us your name.')).toBeHidden();
  await page.getByLabel('Email').fill('sam@example');
  await page.getByLabel('Phone').fill('0400 000 000');
  await guests.fill('4');
  await date.fill('01/01/2020');
  await submit.click();
  await expect(date).toBeFocused();
  await expect(page.getByText('Choose today or a later date.')).toBeVisible();

  const requests: string[] = [];
  page.on('request', (r) => {
    // Next.js may HEAD/GET-prefetch links; only a data submission (POST/PUT/PATCH) would mean "sent".
    if (['POST', 'PUT', 'PATCH'].includes(r.method())) requests.push(`${r.method()} ${r.url()}`);
  });
  await page.getByLabel('Email').fill('sam@example.com');
  await date.fill(`24/08/${new Date().getFullYear() + 1}`);
  await time.fill('10:30');
  await page.getByLabel('Special Requests').fill('High chair please');
  await submit.click();

  const summary = page.getByTestId('booking-summary');
  await expect(summary.getByRole('heading', { name: 'Call us to lock it in.' })).toBeFocused();
  await expect(summary.getByText('nothing has been sent')).toBeVisible();
  await expect(summary).toContainText('10:30 AM');
  await expect(summary).toContainText('High chair please');
  await expect(summary).not.toContainText(/confirmed|reference|request sent/i);
  expect(requests).toEqual([]); // nothing is submitted anywhere

  await summary.getByRole('button', { name: 'Edit details' }).click();
  await expect(page.getByLabel('Name')).toHaveValue('Sam Lee');
});
