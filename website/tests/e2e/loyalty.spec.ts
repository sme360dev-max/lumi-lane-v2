import { expect, test } from '@playwright/test';
import { STAMP_STORAGE_KEY } from '../../src/features/loyalty/stamp-state';

test('Coffee Club teaches the proposed benefit and rules before the demo', async ({ page }) => {
  await page.goto('/loyalty/');
  const main = page.getByRole('main');
  const intro = main.getByRole('region', { name: 'Eight stamps. One coffee.' });
  const ritual = main.getByRole('region', { name: 'The Stamp Ritual.' });
  const details = main.getByRole('region', { name: 'One standard coffee.' });
  await expect(main.getByRole('region')).toHaveText([
    /Lumi Lane Coffee Club[\s\S]+How Coffee Club Works/,
    /The Stamp Ritual/,
    /One standard coffee\.[\s\S]+Coffee Club FAQ/,
  ]);
  await expect(intro.getByText(/In our proposed Coffee Club/)).toBeVisible();
  const steps = intro.getByRole('list');
  await expect(steps.getByRole('heading', { level: 3 })).toHaveText(['Order coffee', 'Collect stamps', 'Unlock a reward']);
  await expect(steps.getByRole('paragraph')).toHaveText([
    'Enjoy an eligible coffee at Lumi Lane.',
    'Each eligible coffee earns one stamp.',
    'Collect eight stamps to unlock a standard coffee reward.',
  ]);
  const explore = intro.getByRole('link', { name: 'Explore Coffee Club' });
  await explore.press('Enter');
  await expect(page).toHaveURL(/#coffee-club-how$/);
  await expect(intro.getByRole('heading', { name: 'How Coffee Club Works' })).toBeFocused();
  await intro.getByRole('link', { name: 'Try the Demo' }).click();
  await expect(page).toHaveURL(/#coffee-club-demo$/);
  await expect(ritual).toBeFocused();
  await expect(ritual.getByRole('button', { name: 'Try a Demo Purchase' })).toHaveAccessibleDescription(/won’t place an order or earn a real reward/);

  const answers = [
    ['How do I earn stamps?', /approved way to verify purchases/],
    ['How many stamps do I need?', /Eight stamps would unlock one reward/],
    ['What reward can I unlock?', /one standard coffee/],
    ['Do I need an account?', /without signing in/],
    ['Can I redeem this reward now?', /yet to approve the program or redemption terms/],
  ] as const;
  for (const [question, answer] of answers) {
    const row = details.locator('details').filter({ has: page.getByText(question, { exact: true }) });
    await row.locator('summary').press('Enter');
    await expect(row.getByText(answer)).toBeVisible();
  }
  const links = details.getByRole('navigation', { name: 'Explore Lumi Lane after Coffee Club' });
  await expect(links.getByRole('link', { name: 'Explore the menu' })).toHaveAttribute('href', '/menu/');
  await expect(links.getByRole('link', { name: 'Visit Us' })).toHaveAttribute('href', '/visit/');
});

test('one click applies a stamp at impact with rapid-click protection, undo and persistence', async ({ page, isMobile }) => {
  test.setTimeout(45_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/loyalty/');
  const ritual = page.getByRole('region', { name: 'The Stamp Ritual.' });
  const progress = ritual.getByRole('progressbar', { name: 'Stamp progress' });
  const earn = ritual.getByRole('button', { name: 'Try a Demo Purchase' });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(ritual.getByRole('button', { name: 'Press stamp' })).toHaveCount(0);
  await expect(ritual.getByRole('button', { name: 'Undo last stamp' })).toBeDisabled();
  if (isMobile) await earn.tap();
  else await earn.press('Space');
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(ritual.getByText('Demo purchase simulated', { exact: true })).toBeVisible();
  await expect(ritual.locator('[data-stamp-slot="0"]')).toHaveAttribute('data-active', 'true');
  await expect(earn).toBeDisabled();
  if (!isMobile) await expect(earn).toBeFocused();

  await earn.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(ritual).toHaveAttribute('data-phase', 'earned');
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(ritual.getByText('+1 stamp', { exact: true })).toBeVisible();
  await earn.click();
  await expect(ritual).toHaveAttribute('data-phase', 'earned');
  await expect(progress).toHaveAttribute('aria-valuenow', '2');
  await ritual.getByRole('button', { name: 'Undo last stamp' }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '1');

  await earn.click();
  await page.reload();
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(earn).toBeEnabled();
  await page.getByRole('link', { name: 'Explore the menu' }).click();
  await expect(page).toHaveURL(/\/menu\/$/);
  await page.goBack();
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await ritual.getByRole('button', { name: 'Reset progress', exact: true }).click();
  await ritual.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await ritual.getByRole('button', { name: 'Reset progress', exact: true }).click();
  await ritual.getByRole('button', { name: 'Reset demo progress', exact: true }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  expect(errors).toEqual([]);
});

test('seven-stamp example unlocks, replays, flips, and starts a new cycle without a request', async ({ page }) => {
  test.setTimeout(45_000);
  const submissions: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.method() !== 'HEAD') submissions.push(request.url());
  });
  await page.goto('/loyalty/');
  const ritual = page.getByRole('region', { name: 'The Stamp Ritual.' });
  const progress = ritual.getByRole('progressbar');
  await ritual.getByRole('button', { name: 'Load 7/8 example' }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '7');
  await expect(ritual.getByText('1 stamp to your demo reward.', { exact: true })).toBeVisible();
  await ritual.getByRole('button', { name: 'Try a Demo Purchase' }).click();
  await expect(ritual.locator('[data-stamp-slot="7"]')).toHaveAttribute('data-active', 'true');
  await expect(progress).toHaveAttribute('aria-valuenow', '8');
  await expect(ritual).toHaveAttribute('data-phase', 'imprint');
  await expect(ritual.locator('[data-filled="true"]')).toHaveCount(8);
  await expect(ritual).toHaveAttribute('data-phase', 'unlocked');
  await expect(progress).toHaveAttribute('aria-valuenow', '8');
  await expect(ritual.getByText('One standard coffee.', { exact: true })).toBeVisible();
  await ritual.getByRole('button', { name: 'View completed card' }).click();
  await expect(ritual.getByRole('list', { name: 'Coffee stamp positions' }).locator('[data-filled="true"]')).toHaveCount(8);
  await ritual.getByRole('button', { name: 'Replay unlock' }).click();
  await expect(ritual).toHaveAttribute('data-phase', 'unlocking');
  await expect(ritual).toHaveAttribute('data-phase', 'unlocked');
  await expect(progress).toHaveAttribute('aria-valuenow', '8');
  await page.reload();
  await expect(ritual).toHaveAttribute('data-phase', 'unlocked');
  const flip = ritual.getByRole('button', { name: 'Flip reward ticket' });
  await flip.press('Enter');
  await expect(flip).toHaveAttribute('aria-pressed', 'true');
  await expect(ritual.getByText('Demo redemption starts a fresh stamp card. No coffee is issued.')).toBeVisible();
  await ritual.getByRole('button', { name: 'Redeem demo reward' }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(ritual.getByText('Demo redeemed. A new stamp card is ready.')).toBeVisible();
  await expect(flip).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), STAMP_STORAGE_KEY)).toBe('0');
  expect(submissions).toEqual([]);
});

test('reduced motion retains stamping and reward access', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/loyalty/');
  await page.getByRole('button', { name: 'Load 7/8 example' }).click();
  await page.getByRole('button', { name: 'Try a Demo Purchase' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8');
  await page.getByRole('button', { name: 'Flip reward ticket' }).click();
  await expect(page.getByRole('button', { name: 'Redeem demo reward' })).toBeEnabled();
});

test('all eight automatic presses align to their own slots through a resize', async ({ page, isMobile }) => {
  test.setTimeout(75_000);
  await page.goto('/loyalty/');
  const ritual = page.getByRole('region', { name: 'The Stamp Ritual.' });
  const earn = ritual.getByRole('button', { name: 'Try a Demo Purchase' });
  const progress = ritual.getByRole('progressbar');
  const viewport = page.viewportSize()!;

  for (let index = 0; index < 8; index++) {
    await ritual.evaluate((section, position) => {
      const slot = section.querySelector(`[data-stamp-slot="${position}"]`)!;
      const heel = section.querySelector('[data-stamp-heel]')!;
      let closest = Number.POSITIVE_INFINITY;
      const started = performance.now();
      function measure(now: number) {
        if (section.getAttribute('data-phase') === 'pressing' || section.getAttribute('data-phase') === 'imprint') {
          const hit = heel.getBoundingClientRect();
          const target = slot.getBoundingClientRect();
          const dx = hit.left + hit.width / 2 - target.left - target.width / 2;
          const dy = hit.bottom - 4 - target.top - target.height / 2;
          closest = Math.min(closest, Math.hypot(dx, dy));
          section.setAttribute('data-test-contact', String(closest));
        }
        if (now - started < 9000 && slot.getAttribute('data-filled') !== 'true') requestAnimationFrame(measure);
      }
      section.removeAttribute('data-test-contact');
      requestAnimationFrame(measure);
    }, index);

    if (isMobile) await earn.tap();
    else await earn.click();
    if (index === 3) {
      await expect(ritual).toHaveAttribute('data-phase', 'pressing');
      await page.setViewportSize({ width: isMobile ? 430 : viewport.width - 120, height: viewport.height });
    }
    await expect(ritual).toHaveAttribute('data-phase', index === 7 ? 'unlocked' : 'earned', { timeout: 10_000 });
    await expect(progress).toHaveAttribute('aria-valuenow', String(index + 1));
    await expect(ritual.locator(`[data-stamp-slot="${index}"]`)).toHaveAttribute('data-filled', 'true');
    const closest = await ritual.getAttribute('data-test-contact');
    expect(closest, `slot ${index + 1} was measured`).not.toBeNull();
    expect(Number(closest), `stamp contact for slot ${index + 1}`).toBeLessThan(15);
    if (index === 3) await page.setViewportSize(viewport);
  }
  await expect(ritual.locator('[data-filled="true"]')).toHaveCount(8);
  await expect(ritual.getByRole('button', { name: 'Flip reward ticket' })).toBeEnabled();
});
