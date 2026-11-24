import { expect, test } from '@playwright/test';

const routes = [
  { url: '/', name: 'home', dark: true },
  { url: '/about/', name: 'about', surface: '#f4ede1' },
  { url: '/menu/', name: 'menu', surface: '#f4ede1' },
  { url: '/visit/', name: 'visit', surface: '#f4ede1' },
  { url: '/book/', name: 'book', surface: '#f4ede1' },
  { url: '/loyalty/', name: 'loyalty', dark: true, surface: '#261912' },
  { url: '/login/', name: 'login', surface: '#faf1e5' },
  { url: '/signup/', name: 'signup', surface: '#faf1e5' },
  { url: '/register/', name: 'register', surface: '#faf1e5' },
  { url: '/cart/', name: 'legacy-cart', surface: '#f4ede1' },
  { url: '/nope/', name: 'not-found', dark: true, surface: '#261912' },
];

test('the transparent header matches every route surface and keeps controls legible', async ({ page }, info) => {
  test.setTimeout(75_000);
  const issues: string[] = [];
  page.on('pageerror', (error) => issues.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('status of 404')) issues.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const masthead = page.locator('.site-header');
  const primary = masthead.getByRole('navigation', { name: 'Primary' });
  const width = page.viewportSize()!.width;
  const snapshot = (name: string, height: number) =>
    page.screenshot({
      path: 'qa/adaptive-header/' + info.project.name + '/' + name + '.png',
      clip: { x: 0, y: 0, width, height },
      scale: 'css',
    });

  for (const route of routes) {
    await page.goto(route.url);
    const bag = masthead.getByRole('button', { name: 'Shopping bag' });
    if (route.name === 'legacy-cart') {
      await expect(page).toHaveURL(/\/menu\/$/);
      await page.getByRole('button', { name: 'Close shopping bag' }).click();
      await expect(bag).toBeFocused();
      await bag.blur();
    }
    await page.mouse.move(0, 0);
    const ink = route.dark ? 'rgb(250, 237, 221)' : 'rgb(38, 25, 18)';
    await expect(masthead).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(masthead.getByRole('link', { name: 'Lumi Lane, home' })).toHaveCSS('color', ink);
    await expect(bag).toHaveCSS('color', ink);
    if (route.surface) {
      expect(
        await page.locator('body').evaluate((body) => getComputedStyle(body).getPropertyValue('--header-page').trim()),
      ).toBe(route.surface);
    }
    expect(
      await masthead.locator('.site-header-inner').evaluate((row) => getComputedStyle(row, '::after').content),
    ).toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width >= 1024) {
      await expect(masthead.getByRole('link', { name: 'Log In' })).toHaveCSS('color', ink);
      await expect(primary.locator('.site-nav-list')).toHaveCSS('color', 'rgb(255, 243, 231)');
      const pill = (await primary.locator('.site-nav-list').boundingBox())!;
      expect(Math.abs(pill.x + pill.width / 2 - width / 2)).toBeLessThan(1);
    }
    await page.evaluate(() => document.fonts.ready);
    await snapshot(route.name, 200);

    if (width < 1024 && ['home', 'about', 'loyalty', 'login'].includes(route.name)) {
      await primary.getByRole('button', { name: 'Open navigation' }).click();
      await expect(primary.getByRole('link', { name: 'Log In' })).toHaveCSS('color', ink);
      await expect(primary.getByRole('link', { name: 'Sign Up' })).toBeVisible();
      await snapshot(route.name + '-open', 414);
    }
  }

  await page.goto('/about/');
  await page.locator('.lane-about-bar').scrollIntoViewIfNeeded();
  await expect(masthead).not.toBeInViewport();
  expect(issues).toEqual([]);
});

test('client navigation switches the palette and distinguishes keyboard focus from the active route', async ({
  page,
}) => {
  await page.goto('/about/');
  const header = page.locator('.site-header');
  const primary = header.getByRole('navigation', { name: 'Primary' });
  const open = primary.getByRole('button', { name: 'Open navigation' });
  if (await open.isVisible()) await open.click();

  const about = primary.getByRole('link', { name: 'About' });
  const label = about.locator('span');
  await expect(about).toHaveAttribute('aria-current', 'page');
  await expect(label).toHaveCSS('text-decoration-thickness', '1px');
  await page.keyboard.press('Tab');
  await about.focus();
  await expect(about).toHaveCSS('outline-style', 'none');
  await expect(label).toHaveCSS('text-decoration-thickness', '2px');

  await primary.getByRole('link', { name: 'Loyalty' }).click();
  await expect(page).toHaveURL(/\/loyalty\/$/);
  await expect(header).toHaveCSS('color', 'rgb(250, 237, 221)');
  await page.goBack();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(header).toHaveCSS('color', 'rgb(38, 25, 18)');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await header.getByRole('link', { name: 'Lumi Lane, home' }).click();
  await expect(header).toHaveCSS('color', 'rgb(250, 237, 221)');
  const carousel = page.locator('.hero');
  const dishes = carousel.getByRole('button', { name: /^Dish \d of/ });
  const swatches = new Set<string>();
  for (const dish of await dishes.all()) {
    await dish.click();
    await expect(header).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    swatches.add(await carousel.evaluate((element) => getComputedStyle(element).backgroundColor));
  }
  expect(swatches.size).toBe(5);
});
