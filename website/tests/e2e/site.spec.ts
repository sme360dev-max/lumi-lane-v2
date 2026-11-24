import { expect, test, type Page } from '@playwright/test';
import { MENU } from '../../src/data/menu';
import { mockBackend } from './support/backend';

const ROUTES = [
  { path: '/', heading: /Chilli eggs/ },
  { path: '/menu/', heading: 'The menu.' },
  { path: '/about/', heading: 'Our story.' },
  { path: '/visit/', heading: 'Visit us.' },
  { path: '/book/', heading: 'Reserve Your Table.' },
];

/** Fails the test on any console error or uncaught page error. */
function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const noHorizontalOverflow = async (page: Page) =>
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(0);

for (const r of ROUTES) {
  test(`direct load ${r.path}: heading, no overflow, no console errors`, async ({ page }) => {
    await mockBackend(page);
    const errors = watchConsole(page);
    const res = await page.goto(r.path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: r.heading })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: r.heading })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('primary navigation, active state, back/forward', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const openNavigation = async () => {
    const toggle = nav.getByRole('button', { name: 'Open navigation' });
    if (await toggle.isVisible()) await toggle.click();
  };
  await openNavigation();
  await nav.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about\/$/);
  await openNavigation();
  await expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Visit Us' }).click();
  await expect(page).toHaveURL(/\/visit\/$/);
  await openNavigation();
  await nav.getByRole('button', { name: 'Menu' }).click();
  await expect(page).toHaveURL(/\/menu\/$/);
  await openNavigation();
  await nav.getByRole('link', { name: 'Book a Table' }).click();
  await expect(page).toHaveURL(/\/book\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/menu\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/visit\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/menu\/$/);
  await page.getByRole('link', { name: 'Lumi Lane, home' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('header groups fit on one row and primary destinations stay in order', async ({ page }, info) => {
  await mockBackend(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const primary = page.getByRole('navigation', { name: 'Primary' });
  const open = primary.getByRole('button', { name: 'Open navigation' });
  const list = primary.locator('#site-nav-items');
  const actions = page.getByRole('navigation', { name: 'Account and shopping' });
  const wide = info.project.name === 'desktop-1440';
  const viewportWidth = page.viewportSize()!.width;
  const logoBox = (await page.getByRole('link', { name: 'Lumi Lane, home' }).boundingBox())!;
  const navBox = (await (wide ? list : open).boundingBox())!;
  const actionsBox = (await actions.boundingBox())!;
  // Links (or the menu button) left, wordmark centred, account and bag right, all on one line.
  expect(navBox.x + navBox.width).toBeLessThanOrEqual(logoBox.x);
  expect(logoBox.x + logoBox.width).toBeLessThanOrEqual(actionsBox.x);
  expect(Math.abs(logoBox.x + logoBox.width / 2 - viewportWidth / 2)).toBeLessThan(1);
  expect(navBox.y + navBox.height / 2).toBeCloseTo(actionsBox.y + actionsBox.height / 2);
  expect(logoBox.y + logoBox.height / 2).toBeCloseTo(actionsBox.y + actionsBox.height / 2);
  await noHorizontalOverflow(page);

  if (wide) {
    // Plain words in the bar: no pill, no fill, 44px targets.
    expect(navBox.height).toBe(44);
    await expect(list).toHaveCSS('border-top-left-radius', '0px');
    await expect(list).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(list).toHaveCSS('color', 'rgb(39, 27, 21)');
    await expect(open).toBeHidden();
    await expect(actions.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(actions.getByRole('link', { name: 'Sign up' })).toBeVisible();
  } else {
    await expect(list).toBeHidden();
    await expect(actions.getByRole('link', { name: 'Log in' })).toHaveCount(0);
    await open.focus();
    await page.keyboard.press('Enter');
    const close = primary.getByRole('button', { name: 'Close navigation' });
    await expect(close).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(primary.getByRole('link', { name: 'About' })).toBeFocused();
    await expect(primary.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(primary.getByRole('link', { name: 'Sign up' })).toBeVisible();
  }

  await expect(list.locator(':scope > li > :is(a, button)')).toHaveText([
    'About',
    'Menu',
    'Visit us',
    'Book a table',
    'Loyalty',
  ]);
  await noHorizontalOverflow(page);
  if (!wide) {
    await page.keyboard.press('Escape');
    await expect(open).toBeFocused();
    await expect(list).toBeHidden();
    await open.click();
  }
  await primary.getByRole('link', { name: 'Loyalty' }).click();
  await expect(page).toHaveURL(/\/loyalty\/$/);
  await expect(page.getByRole('heading', { level: 1, name: /8 points\./ })).toBeVisible();
  if (info.project.name === 'mobile-390') {
    await page.setViewportSize({ width: 320, height: 720 });
    const narrowLogo = (await page.getByRole('link', { name: 'Lumi Lane, home' }).boundingBox())!;
    const narrowToggle = (await open.boundingBox())!;
    const narrowBag = (await actions.getByRole('button', { name: 'Shopping bag' }).boundingBox())!;
    expect(narrowToggle.x + narrowToggle.width).toBeLessThanOrEqual(narrowLogo.x);
    expect(narrowLogo.x + narrowLogo.width).toBeLessThanOrEqual(narrowBag.x);
    await noHorizontalOverflow(page);
  }
});

test('the header opens account forms and the bag without navigating', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  const actions = page.getByRole('navigation', { name: 'Account and shopping' });
  const primary = page.getByRole('navigation', { name: 'Primary' });
  const open = primary.getByRole('button', { name: 'Open navigation' });
  const visitAccount = async (name: string) => {
    const mobile = await open.isVisible();
    if (mobile) await open.click();
    await (mobile ? primary : actions).getByRole('link', { name }).click();
  };
  await visitAccount('Log in');
  await expect(page).toHaveURL(/\/login\/$/);
  // The login page also carries a collapsed password-reset form; this is the sign-in form's own field.
  await expect(page.getByRole('main').locator('form.account-form').getByLabel('Email address')).toBeVisible();
  await visitAccount('Sign up');
  await expect(page).toHaveURL(/\/signup\/$/);
  await expect(page.getByRole('main').getByLabel('Full name')).toBeVisible();
  await actions.getByRole('button', { name: 'Shopping bag' }).click();
  await expect(page).toHaveURL(/\/signup\/$/);
  const bag = page.getByRole('dialog', { name: 'Your bag' });
  await expect(bag.getByText('Your bag is empty.', { exact: false })).toBeVisible();
  await bag.getByRole('link', { name: 'Browse menu' }).click();
  await expect(page).toHaveURL(/\/menu\/$/);
});

test('every menu category renders all of its items and prices', async ({ page }) => {
  await page.goto('/menu/');
  for (const cat of MENU) {
    await page.getByRole('tab', { name: cat.label }).click();
    await expect(page.getByRole('tab', { name: cat.label })).toHaveAttribute('aria-selected', 'true');
    const panel = page.getByRole('tabpanel', { name: cat.label });
    await expect(panel).toBeVisible();
    const items = cat.columns.flatMap((c) => (c.kind === 'list' ? c.items : []));
    await expect(panel.locator('[data-item-id]')).toHaveCount(items.length);
    const names = await panel.locator('h4').allTextContents();
    expect(names).toEqual(items.map((i) => i.name));
    for (const it of items)
      if (it.kind === 'std') await expect(panel.locator(`[data-item-id="${it.id}"] [data-price]`)).toHaveText(it.price);
  }
  await expect(page).toHaveURL(/#bar$/);
});

test('homepage has the carousel, one brand intro, the explore stage with three destinations and the shared footer', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const main = page.getByRole('main');
  await expect(main.locator(':scope > *')).toHaveCount(2);
  await expect(main.locator(':scope > section[aria-roledescription="carousel"]')).toBeVisible();
  await expect(main.locator(':scope > div > section')).toHaveCount(2);
  const intro = main.getByRole('region', { name: 'A coffee house with a long table.' });
  await expect(intro.getByRole('link')).toHaveAttribute('href', '/about/');
  const showcase = main.getByRole('region', { name: 'Explore Lumi Lane' });
  await expect(showcase.getByRole('heading', { level: 2, name: 'Explore Lumi Lane' })).toBeVisible();
  await expect(showcase.getByRole('heading', { level: 3 })).toHaveText(['Menu', 'Book a Table', 'Loyalty']);
  // The destinations are an editorial list: the photographs belong to the stage and are decorative.
  await expect(showcase.getByRole('img')).toHaveCount(0);
  await expect(showcase.getByRole('listitem').locator('img, svg')).toHaveCount(0);
  // The loyalty line describes the points programme the Loyalty page actually runs.
  await expect(showcase.getByRole('listitem').nth(2)).toContainText('Earn points on completed orders');
  await expect(showcase.getByText('Ask the team about loyalty')).toHaveCount(0);
  const actions = showcase.getByRole('link');
  await expect(actions).toHaveCount(3);
  for (const [index, href] of ['/menu/', '/book/', '/loyalty/'].entries()) {
    await expect(actions.nth(index)).toHaveAttribute('href', href);
    await actions.nth(index).click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await page.goBack();
    await expect(showcase).toBeVisible();
  }
  const footer = page.locator('main#main + footer');
  await expect(footer.getByRole('navigation', { name: 'Footer' }).getByRole('link')).toHaveCount(5);
  await expect(footer.getByRole('list', { name: 'Social media' }).getByRole('link')).toHaveCount(3);
  const gap = await footer.evaluate(
    (element) => element.getBoundingClientRect().top - element.previousElementSibling!.getBoundingClientRect().bottom,
  );
  expect(Math.abs(gap)).toBeLessThan(1);
});

test('the explore stage follows the cursor on desktop and offers a pausable strip elsewhere', async ({ page }, info) => {
  await page.goto('/');
  const showcase = page.getByRole('main').getByRole('region', { name: 'Explore Lumi Lane' });
  const stage = showcase.locator(':scope > div').first();
  await stage.scrollIntoViewIfNeeded();
  const toggle = stage.getByRole('button', { name: /photos$/ });
  const tiles = stage.locator('[aria-hidden="true"]').first().locator(':scope > span');
  // A tile counts once it is both laid out and visible (the pool is display:none outside trail mode).
  const shown = () =>
    tiles.evaluateAll(
      (nodes) => nodes.filter((node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility === 'visible').length,
    );

  if (info.project.name === 'mobile-390') {
    // No cursor to follow: the photographs drift as a strip that the visitor can stop.
    await expect(toggle).toHaveText('Pause photos');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const strip = stage.locator('[data-paused]');
    const state = () => strip.locator(':scope > div > div').evaluate((track) => getComputedStyle(track).animationPlayState);
    expect(await state()).toBe('running');
    await toggle.click();
    await expect(toggle).toHaveText('Play photos');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(await state()).toBe('paused');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    return;
  }

  await expect(toggle).toBeHidden();
  const box = (await stage.boundingBox())!;
  expect(box.width).toBe(page.viewportSize()!.width);
  expect(box.height / page.viewportSize()!.height).toBeGreaterThan(0.66);
  expect(await shown()).toBe(0);
  // A small twitch of the cursor sets nothing down; real travel does.
  await page.mouse.move(box.x + 100, box.y + box.height / 2);
  await page.mouse.move(box.x + 120, box.y + box.height / 2 + 10);
  expect(await shown()).toBe(0);
  const stride = (box.width - 240) / 8;
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(box.x + 120 + step * stride, box.y + box.height / 2 + (step % 2 ? 60 : -60), { steps: 3 });
    await page.waitForTimeout(90);
  }
  await expect.poll(shown).toBeGreaterThan(2);
  // Every photograph leaves again within a couple of seconds of the cursor resting.
  await expect.poll(shown, { timeout: 4_000 }).toBe(0);

  // Reduced motion replaces the trail with the still strip.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveText('Play photos');
  await page.mouse.move(box.x + 100, box.y + 80);
  await page.mouse.move(box.x + box.width - 100, box.y + 200, { steps: 4 });
  expect(await shown()).toBe(0);
});

test('menu tabs: keyboard, deep link, refresh, back', async ({ page }) => {
  await page.goto('/menu/#coffee');
  await expect(page.getByRole('tab', { name: 'Coffee & Drinks' })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Coffee & Drinks' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Coffee & Drinks' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Bar' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Bar' })).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(page.getByRole('tab', { name: 'Coffee & Drinks' })).toHaveAttribute('aria-selected', 'true');
});

test('legacy hash links redirect to the real routes', async ({ page }) => {
  await page.goto('/#reserve');
  await expect(page).toHaveURL(/\/book\/$/);
  await page.goto('/#menu/acai');
  await expect(page).toHaveURL(/\/menu\/#acai$/);
  await expect(page.getByRole('tab', { name: 'Açai' })).toHaveAttribute('aria-selected', 'true');
});

test('mega menu opens on hover, links to a category, closes on Escape', async ({ page, isMobile }, info) => {
  test.skip(isMobile || info.project.name !== 'desktop-1440', 'hover interaction is desktop only');
  await page.goto('/about/');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Menu' }).hover();
  const mega = page.getByRole('dialog', { name: 'Menu overview' });
  await expect(mega).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(mega).toBeHidden();
  await page.mouse.move(10, 10);
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Menu' }).hover();
  await mega.getByRole('link', { name: /Bar/ }).click();
  await expect(page).toHaveURL(/\/menu\/#bar$/);
  await expect(page.getByRole('tab', { name: 'Bar' })).toHaveAttribute('aria-selected', 'true');
});
