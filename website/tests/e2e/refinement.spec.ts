import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login/');
  const main = page.getByRole('main');
  await main.getByLabel('Email address').fill('minh.test@example.com');
  await main.getByLabel('Password', { exact: true }).fill('LumiTest2026!');
  await main.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/account\/$/);
  await expect(main.getByText(/Welcome, Minh Test/)).toBeVisible();
}

async function accountSection(page: Page, name: string, id: string) {
  const select = page.getByRole('combobox', { name: 'Account section', exact: true });
  if (page.viewportSize()!.width <= 760) await select.selectOption(id);
  else
    await page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp('#' + id + '$'));
}

test('profile, favorites, reservation tabs and opt-in order examples use honest local state', async ({
  page,
}, info) => {
  test.setTimeout(55_000);
  const capture = (name: string) =>
    info.project.name === 'desktop-1440'
      ? page.screenshot({ path: `qa/four-phase/${name}-1440.png`, scale: 'css' })
      : Promise.resolve();
  await login(page);
  const main = page.getByRole('main');
  await accountSection(page, 'Active orders', 'orders');
  await expect(main.getByText('You have no active orders.')).toBeVisible();
  await expect(main.getByText('Preparing', { exact: true })).toHaveCount(0);

  await accountSection(page, 'Edit profile', 'profile');
  await main.getByLabel('Full name').fill('');
  await main.getByRole('button', { name: 'Save profile' }).click();
  await expect(main.getByLabel('Full name')).toBeFocused();
  await expect(main.getByLabel('Full name')).toHaveAttribute('aria-invalid', 'true');
  await main.getByLabel('Full name').fill('Lan Test');
  await main.getByRole('radio', { name: 'Espresso' }).check();
  await main.getByRole('button', { name: 'Save profile' }).click();
  await expect(main.getByRole('status')).toContainText('Profile saved');
  await page.reload();
  await expect(main.getByLabel('Full name')).toHaveValue('Lan Test');
  await main.getByLabel('Full name').fill('Discard me');
  await main.getByRole('button', { name: 'Cancel edits' }).click();
  await expect(main.getByLabel('Full name')).toHaveValue('Lan Test');

  await accountSection(page, 'Reservations', 'reservations');
  await expect(main.getByText('No upcoming reservations.')).toBeVisible();
  await main.getByRole('button', { name: 'Past', exact: true }).click();
  await expect(main.getByText('No past reservations.')).toBeVisible();

  await page.goto('/menu/');
  const heart = main.getByRole('button', { name: 'Favorite Chilli Eggs', exact: true });
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/account/#favorites');
  const saved = main.getByRole('list', { name: 'Saved menu items' });
  await expect(saved.getByText('Chilli Eggs')).toBeVisible();
  await capture('account-saved-favorite');
  await saved.getByRole('button', { name: 'Add one Chilli Eggs' }).click();
  await saved.getByRole('button', { name: 'Favorite Chilli Eggs' }).click();
  await expect(main.getByText('No favorite dishes yet.')).toBeVisible();

  await accountSection(page, 'Preferences', 'preferences');
  await main.getByRole('checkbox', { name: /Show example orders/ }).check();
  await main.getByRole('checkbox', { name: /Compact dashboard/ }).check();
  await expect(main.locator('.dashboard-shell')).toHaveAttribute('data-compact', 'true');
  await accountSection(page, 'Active orders', 'orders');
  await expect(main.getByText('Demo Preview · Example orders')).toBeVisible();
  await main.getByText('Example EX-01', { exact: true }).click();
  await expect(main.getByRole('list', { name: 'Example order timeline' }).locator('[aria-current="step"]')).toHaveText(
    'Preparing',
  );
  await capture('account-example-timeline');
  await accountSection(page, 'Order history', 'history');
  await main.getByText('Example EX-02', { exact: true }).click();
  await expect(main.getByText('Example subtotal', { exact: true })).toBeVisible();
  await capture('account-example-history');
  await main.getByRole('button', { name: 'Reorder example items' }).click();
  const bag = page.getByRole('dialog', { name: 'Your bag' });
  await expect(bag.getByText('Chilli Eggs', { exact: true })).toBeVisible();
  await expect(bag.getByText('Cafe Latte', { exact: true })).toBeVisible();
  await expect(bag.getByTestId('cart-subtotal')).toHaveText('$53.60 AUD');
  await bag.getByRole('button', { name: 'Close shopping bag' }).click();
  await expect(main.getByRole('button', { name: 'Reorder example items' })).toBeFocused();
  await accountSection(page, 'Preferences', 'preferences');
  await main.getByRole('checkbox', { name: /Show example orders/ }).uncheck();
  await accountSection(page, 'Order history', 'history');
  await expect(main.getByText('No past orders yet.')).toBeVisible();
});

test('editorial menu and anchored filter preserve category and real price choices', async ({ page }) => {
  await page.goto('/menu/');
  const main = page.getByRole('main');
  const first = main.getByRole('heading', { name: 'All Day', exact: true });
  const second = main.getByRole('heading', { name: 'Sweet', exact: true });
  const width = page.viewportSize()!.width;
  const start = (await first.boundingBox())!;
  const next = (await second.boundingBox())!;
  if (width > 650) {
    expect(next.x).toBeGreaterThan(start.x);
    expect(Math.abs(next.y - start.y)).toBeLessThan(2);
  } else expect(next.y).toBeGreaterThan(start.y);
  await expect(main.locator('.lane-menu-item img')).toHaveCount(0);
  const trigger = main.getByRole('button', { name: 'Sort & Filter' });
  await trigger.click();
  const panel = page.getByRole('dialog', { name: 'Sort & Filter' });
  await expect(panel.getByRole('option', { name: /Best Sellers/ })).toBeDisabled();
  await panel.getByLabel('Category').selectOption('coffee');
  await panel.getByLabel('Sort by').selectOption('low');
  await panel.getByLabel('Minimum price').fill('5');
  await panel.getByLabel('Maximum price').fill('4');
  await panel.getByRole('button', { name: 'Apply filters' }).click();
  await expect(panel.getByRole('alert')).toBeVisible();
  await panel.getByLabel('Maximum price').fill('8');
  await panel.getByRole('button', { name: 'Apply filters' }).click();
  await expect(main.getByRole('tab', { name: 'Coffee & Drinks' })).toHaveAttribute('aria-selected', 'true');
  await expect(main.getByRole('heading', { name: 'Sorted results' })).toBeVisible();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

for (const width of [390, 768, 1024, 1440]) {
  test(`capture four-phase menu and dashboard at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-1440', 'This test sets the viewport explicitly.');
    test.setTimeout(65_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const capture = async (name: string) => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `qa/four-phase/${name}-${width}.png`, scale: 'css' });
    };
    await page.goto('/menu/');
    const main = page.getByRole('main');
    await capture('editorial-menu');
    await main.getByRole('button', { name: 'Sort & Filter' }).click();
    await expect(page.getByRole('dialog', { name: 'Sort & Filter' })).toBeVisible();
    await capture('sort-filter');
    await page.keyboard.press('Escape');
    await login(page);
    await capture('account-overview');
    if (width === 390 || width === 1440) {
      for (const [id, label] of [
        ['orders', 'Active orders'],
        ['history', 'Order history'],
        ['profile', 'Edit profile'],
        ['favorites', 'Favorites'],
      ] as const) {
        await accountSection(page, label, id);
        await expect(main.getByRole('heading', { name: label, exact: true })).toBeVisible();
        await capture('account-' + id);
      }
    }
    expect(errors).toEqual([]);
  });
}

test('footer curtain settles on a tall display and respects reduced motion', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'This test sets a tall desktop viewport explicitly.');
  await page.setViewportSize({ width: 1440, height: 1600 });
  await page.goto('/about/');
  const footer = page.getByRole('contentinfo');
  const layer = footer.locator('.footer-curtain');
  const move = (visible: number) =>
    footer.evaluate((element, amount) => {
      window.scrollTo({
        top: window.scrollY + element.getBoundingClientRect().top - window.innerHeight + amount,
        behavior: 'instant',
      });
    }, visible);
  const y = () => layer.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42);

  await move(120);
  await expect.poll(y).toBeLessThan(-10);
  await page.screenshot({ path: 'qa/four-phase/curtain-in-progress.png', scale: 'css' });
  await footer.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await expect.poll(y).toBeGreaterThan(-2);
  await expect(footer.getByRole('link', { name: 'Back to content' })).toBeInViewport();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(y).toBe(0);
});
