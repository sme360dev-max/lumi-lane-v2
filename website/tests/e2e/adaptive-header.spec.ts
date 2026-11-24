import { expect, test, type Locator } from '@playwright/test';
import { mockBackend } from './support/backend';

const INK = 'rgb(39, 27, 21)';
const CLAY = 'rgb(147, 71, 51)';

const routes = [
  { url: '/', name: 'home' },
  { url: '/about/', name: 'about' },
  { url: '/menu/', name: 'menu' },
  { url: '/visit/', name: 'visit' },
  { url: '/book/', name: 'book' },
  { url: '/loyalty/', name: 'loyalty' },
  { url: '/login/', name: 'login' },
  { url: '/signup/', name: 'signup' },
  { url: '/register/', name: 'register' },
  { url: '/cart/', name: 'legacy-cart' },
  { url: '/nope/', name: 'not-found' },
];

const pseudo = (locator: Locator, which: '::before' | '::after', property: 'backgroundColor' | 'opacity') =>
  locator.evaluate((element, [name, key]) => getComputedStyle(element, name)[key as 'opacity'], [which, property]);

test('the masthead is the same cream bar on every route and keeps controls legible', async ({ page }, info) => {
  test.setTimeout(75_000);
  await mockBackend(page);
  const issues: string[] = [];
  page.on('pageerror', (error) => issues.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('status of 404')) issues.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const masthead = page.locator('.site-header');
  const primary = masthead.getByRole('navigation', { name: 'Primary' });
  const wordmark = masthead.getByRole('link', { name: 'Lumi Lane, home' });
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

    // One bar: sticky, 72px, cream, dark ink, with no hairline until the page moves beneath it.
    await expect(masthead).toHaveCSS('position', 'sticky');
    const bar = (await masthead.boundingBox())!;
    expect(bar.y).toBe(0);
    expect(bar.height).toBe(72);
    expect(await pseudo(masthead, '::before', 'backgroundColor')).toMatch(/^rgba\(244, 237, 225, 0\.9\d*\)$/);
    expect(await pseudo(masthead, '::after', 'opacity')).toBe('0');
    await expect(wordmark).toHaveCSS('color', INK);
    await expect(bag).toHaveCSS('color', INK);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    // Three groups on one row with the wordmark on the true centre.
    const logo = (await wordmark.boundingBox())!;
    const cart = (await bag.boundingBox())!;
    expect(Math.abs(logo.x + logo.width / 2 - width / 2)).toBeLessThan(1);
    expect(logo.x + logo.width).toBeLessThanOrEqual(cart.x);
    if (width >= 1024) {
      const links = (await primary.locator('.site-nav-list').boundingBox())!;
      expect(links.x + links.width).toBeLessThanOrEqual(logo.x);
      await expect(masthead.getByRole('link', { name: 'Log in' })).toHaveCSS('color', INK);
      await expect(primary.locator('.site-nav-list')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(primary.getByRole('link', { name: 'About' })).toHaveCSS('font-size', '14px');
      await expect(primary.getByRole('link', { name: 'About' })).toHaveCSS('text-transform', 'none');
    } else {
      const toggle = (await primary.getByRole('button', { name: 'Open navigation' }).boundingBox())!;
      expect(toggle.x + toggle.width).toBeLessThanOrEqual(logo.x);
      expect(toggle.width).toBeGreaterThanOrEqual(44);
      expect(toggle.height).toBeGreaterThanOrEqual(44);
    }
    expect(cart.width).toBeGreaterThanOrEqual(44);
    expect(cart.height).toBeGreaterThanOrEqual(44);
    await page.evaluate(() => document.fonts.ready);
    await snapshot(route.name, 200);

    if (width < 1024 && ['home', 'about', 'loyalty', 'login'].includes(route.name)) {
      await primary.getByRole('button', { name: 'Open navigation' }).click();
      const sheet = primary.locator('#site-nav-panel');
      const panel = (await sheet.boundingBox())!;
      const viewport = page.viewportSize()!;
      // A full-height cream sheet under the bar, with the page behind it held still.
      expect(panel.x).toBe(0);
      expect(panel.width).toBe(viewport.width);
      expect(panel.y).toBe(72);
      expect(Math.abs(panel.y + panel.height - viewport.height)).toBeLessThan(1);
      await expect(sheet).toHaveCSS('background-color', 'rgb(244, 237, 225)');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe('hidden');
      await expect(primary.getByRole('link', { name: 'About' })).toHaveCSS('font-family', /Playfair Display/);
      await expect(primary.getByRole('link', { name: 'Log in' })).toHaveCSS('color', INK);
      await expect(primary.getByRole('link', { name: 'Sign up' })).toBeVisible();
      await snapshot(route.name + '-open', viewport.height);
    }
  }

  // The bar stays with the reader, and its hairline arrives once the page has moved.
  await page.goto('/about/');
  await page.locator('.lane-about-bar').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(72);
  await expect(masthead).toBeInViewport();
  expect((await masthead.boundingBox())!.y).toBe(0);
  await expect(masthead).toHaveAttribute('data-scrolled', 'true');
  await expect.poll(() => pseudo(masthead, '::after', 'opacity')).toBe('1');
  expect(issues).toEqual([]);
});

test('client navigation moves the active underline and draws keyboard focus separately', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/about/');
  const header = page.locator('.site-header');
  const primary = header.getByRole('navigation', { name: 'Primary' });
  const open = primary.getByRole('button', { name: 'Open navigation' });
  const desktop = !(await open.isVisible());
  const about = primary.getByRole('link', { name: 'About' });
  const indicator = primary.locator('.site-nav-indicator');
  const under = async (label: Locator) => {
    const rule = (await indicator.boundingBox())!;
    const word = (await label.boundingBox())!;
    return Math.max(Math.abs(rule.x - word.x), Math.abs(rule.width - word.width), Math.abs(rule.y + rule.height - (word.y + word.height)));
  };

  if (desktop) {
    await expect(about).toHaveAttribute('aria-current', 'page');
    // One 1.5px clay rule sits under the current page's word.
    await expect(indicator).toHaveCSS('opacity', '1');
    await expect(indicator).toHaveCSS('background-color', CLAY);
    await expect(indicator).toHaveCSS('height', '1.5px');
    await expect.poll(() => under(about.locator('span'))).toBeLessThan(1);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
  } else {
    await open.focus();
    await page.keyboard.press('Enter');
    await expect(about).toHaveAttribute('aria-current', 'page');
    // In the sheet the current page is the italic, clay line.
    await expect(about).toHaveCSS('font-style', 'italic');
    await expect(about).toHaveCSS('color', CLAY);
    await expect(indicator).toBeHidden();
    await page.keyboard.press('Tab');
  }
  // Keyboard focus is an outline, never the same mark as the active page.
  await expect(about).toBeFocused();
  await expect(about).toHaveCSS('outline-style', 'solid');
  await expect(about).toHaveCSS('outline-width', '2px');

  const loyalty = primary.getByRole('link', { name: 'Loyalty' });
  await loyalty.click();
  await expect(page).toHaveURL(/\/loyalty\/$/);
  // The bar keeps its own cream and ink over a dark page.
  await expect(header).toHaveCSS('color', INK);
  if (desktop) {
    await expect(loyalty).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => under(loyalty.locator('span'))).toBeLessThan(1);
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/about\/$/);
  if (desktop) await expect.poll(() => under(about.locator('span'))).toBeLessThan(1);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await header.getByRole('link', { name: 'Lumi Lane, home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(header).toHaveCSS('color', INK);
  if (desktop) await expect(indicator).toHaveCSS('opacity', '0');
  const carousel = page.locator('.hero');
  const dishes = carousel.getByRole('button', { name: /^Dish \d of/ });
  const swatches = new Set<string>();
  for (const dish of await dishes.all()) {
    await dish.click();
    expect(await pseudo(header, '::before', 'backgroundColor')).toMatch(/^rgba\(244, 237, 225, 0\.9\d*\)$/);
    swatches.add(await carousel.evaluate((element) => getComputedStyle(element).backgroundColor));
  }
  expect(swatches.size).toBe(5);
});
