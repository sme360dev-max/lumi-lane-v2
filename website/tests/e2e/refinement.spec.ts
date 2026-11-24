import { expect, test, type Page, type Request } from '@playwright/test';
import { LOYALTY_PROGRAM, mockBackend, type MockHandlers, type MockResponse } from './support/backend';

/* ---------- Account API stand-in (shapes follow backend/accounts/views.py and src/features/account) ---------- */

const TOKEN_KEY = 'lumi-lane-account-token-v1';
const FAVORITES_KEY = 'lumi-lane-favorites-v1';
const TOKEN = 'e2e-account-token';
const PASSWORD = 'LumiTest2026!';
const CHILLI_EGGS_ID = 'brunch-chilli-eggs';
const CHILLI_EGGS = `${CHILLI_EGGS_ID}:standard`;
const CAFE_LATTE_ID = 'coffee-cafe-latte';
const CAFE_LATTE = `${CAFE_LATTE_ID}:standard`;

type Profile = { id: string; name: string; email: string; phone: string; avatar: 'clay' | 'espresso' };
type OrderLine = {
  key: string;
  itemId: string;
  category: string;
  name: string;
  label: string;
  cents: number;
  quantity: number;
  subtotal: number;
};
type Order = {
  id: string;
  date: string;
  createdAt: string;
  status: string;
  statusLabel: string;
  totalCents: number;
  subtotalCents: number;
  rewardCents: number;
  items: OrderLine[];
};
type Reservation = { id: string; date: string; time: string; guests: number; status: string; notes: string };
type AccountState = {
  account: Profile;
  preferences: { compact: boolean };
  favorites: string[];
  cart: Record<string, number>;
  orders: Order[];
  reservations: Reservation[];
};

const line = (itemId: string, category: string, name: string, cents: number, quantity: number): OrderLine => ({
  key: `${itemId}:standard`,
  itemId,
  category,
  name,
  label: '',
  cents,
  quantity,
  subtotal: cents * quantity,
});

const order = (id: string, date: string, status: string, statusLabel: string, items: OrderLine[]): Order => {
  const subtotalCents = items.reduce((total, { subtotal }) => total + subtotal, 0);
  return {
    id,
    date,
    createdAt: `${date}T01:30:00+00:00`,
    status,
    statusLabel,
    totalCents: subtotalCents,
    subtotalCents,
    rewardCents: 0,
    items,
  };
};

/** One order the venue is still preparing and one it has completed, as the API reports them. */
const ACTIVE_ORDER = order('5d0e7a1c-3b2f-4c68-9a57-0f1e2d3c4b5a', '2026-11-20', 'preparing', 'Preparing', [
  line(CHILLI_EGGS_ID, 'brunch', 'Chilli Eggs', 2190, 1),
  line(CAFE_LATTE_ID, 'coffee', 'Cafe Latte', 490, 1),
]);
const PAST_ORDER = order('9c4b2e7f-6a1d-4e35-8b90-7c6d5e4f3a2b', '2026-11-12', 'completed', 'Completed', [
  line(CHILLI_EGGS_ID, 'brunch', 'Chilli Eggs', 2190, 1),
  line(CAFE_LATTE_ID, 'coffee', 'Cafe Latte', 490, 2),
]);
const UPCOMING_TABLE: Reservation = {
  id: '1f2e3d4c-5b6a-4978-8a69-5b4c3d2e1f00',
  date: '2099-01-15',
  time: '18:30',
  guests: 4,
  status: 'Confirmed',
  notes: '',
};
const PAST_TABLE: Reservation = {
  id: '0a9b8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d',
  date: '2020-03-07',
  time: '09:00',
  guests: 2,
  status: 'Contacted',
  notes: '',
};

/**
 * Answers the account endpoints from one in-memory account, so a saved profile, preference, favourite
 * or bag is what a later request (or a reload) reads back. Every account route needs the bearer token
 * the login response issued, as the service does.
 */
async function mockAccount(page: Page, seed: Partial<AccountState> = {}) {
  const state: AccountState = {
    account: {
      id: 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f607',
      name: 'Minh Test',
      email: 'minh.test@example.com',
      phone: '',
      avatar: 'clay',
    },
    preferences: { compact: false },
    favorites: [],
    cart: {},
    orders: [],
    reservations: [],
    ...seed,
  };
  const json = <T>(request: Request) => request.postDataJSON() as T;
  const signedIn =
    (respond: (request: Request) => MockResponse) =>
    (request: Request): MockResponse =>
      request.headers().authorization === `Bearer ${TOKEN}`
        ? respond(request)
        : { status: 401, body: { error: 'Sign in to continue.' } };
  const rewards = () => ({ program: LOYALTY_PROGRAM, points: 0, rewardBalanceCents: 0, entries: [] });
  const cart = () => ({ items: state.cart, lines: [] });

  const handlers: MockHandlers = {
    'POST /api/account/login/': (request) => {
      const { email = '', password = '' } = json<{ email?: string; password?: string }>(request);
      return email.trim().toLowerCase() === state.account.email && password === PASSWORD
        ? { body: { account: state.account, token: TOKEN } }
        : { status: 401, body: { error: 'Email or password is incorrect.' } };
    },
    'GET /api/account/me/': signedIn(() => ({ body: { account: state.account } })),
    'PATCH /api/account/me/': signedIn((request) => {
      const change = json<Partial<Profile>>(request);
      if (!change.name?.trim()) {
        return {
          status: 400,
          body: {
            error: 'Please check the highlighted details.',
            errors: { name: 'Enter a name of 1–80 characters.' },
          },
        };
      }
      state.account = { ...state.account, ...change, id: state.account.id };
      return { body: { account: state.account } };
    }),
    'GET /api/account/dashboard/': signedIn(() => ({
      body: {
        account: state.account,
        preferences: { ...state.preferences, examples: false },
        favorites: state.favorites,
        cart: cart(),
        orders: state.orders,
        reservations: state.reservations,
        rewards: rewards(),
      },
    })),
    'PATCH /api/account/preferences/': signedIn((request) => {
      const { compact } = json<{ compact?: unknown }>(request);
      if (typeof compact !== 'boolean') return { status: 400, body: { error: 'compact must be true or false.' } };
      state.preferences = { compact };
      return { body: { preferences: { compact, examples: false } } };
    }),
    'GET /api/account/favorites/': signedIn(() => ({ body: { items: state.favorites } })),
    'PUT /api/account/favorites/': signedIn((request) => {
      state.favorites = [...json<{ items: string[] }>(request).items].sort();
      return { body: { items: state.favorites } };
    }),
    'GET /api/account/cart/': signedIn(() => ({ body: cart() })),
    'PUT /api/account/cart/': signedIn((request) => {
      state.cart = json<{ items: Record<string, number> }>(request).items;
      return { body: cart() };
    }),
    'DELETE /api/account/cart/': signedIn(() => {
      state.cart = {};
      return { body: cart() };
    }),
    'GET /api/account/rewards/': signedIn(() => ({ body: rewards() })),
  };

  const seen = await mockBackend(page, handlers);
  const known = new Set([...Object.keys(handlers), 'GET /api/menu/', 'GET /api/loyalty/']);
  return {
    state,
    seen,
    /** Bodies of every request made to one endpoint, in order. */
    sent: (method: string, path: string) =>
      seen.filter((request) => request.method === method && request.path === path).map(({ body }) => body),
    /** Calls to endpoints this account does not describe; they were answered 404. */
    unexpected: () => seen.filter(({ method, path }) => !known.has(`${method} ${path}`)),
  };
}

type AccountBackend = Awaited<ReturnType<typeof mockAccount>>;

/** Signs in through the real form. The login page also holds a collapsed password-reset form. */
async function login(page: Page, backend: AccountBackend) {
  await page.goto('/login/');
  const main = page.getByRole('main');
  const form = main.locator('form.account-form');
  await form.getByLabel('Email address').fill(backend.state.account.email);
  await form.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await form.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/account\/$/);
  await expect(main.getByText(new RegExp(`Welcome, ${backend.state.account.name}`))).toBeVisible();
  expect(backend.sent('POST', '/api/account/login/')).toEqual([
    { fullName: '', email: backend.state.account.email, password: PASSWORD },
  ]);
  expect(await page.evaluate((key) => window.sessionStorage.getItem(key), TOKEN_KEY)).toBe(TOKEN);
}

async function accountSection(page: Page, name: string, id: string) {
  const select = page.getByRole('combobox', { name: 'Account section', exact: true });
  if (page.viewportSize()!.width <= 760) await select.selectOption(id);
  else
    await page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp('#' + id + '$'));
}

test('profile, favorites, reservation tabs and account orders use honest account state', async ({ page }, info) => {
  test.setTimeout(55_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const capture = (name: string) =>
    info.project.name === 'desktop-1440'
      ? page.screenshot({ path: `qa/four-phase/${name}-1440.png`, scale: 'css' })
      : Promise.resolve();
  const backend = await mockAccount(page);
  const requests = (method: string, path: string) => backend.sent(method, path).length;
  await login(page, backend);
  const main = page.getByRole('main');

  // A new account has nothing to show, and nothing is invented for it.
  await accountSection(page, 'Active orders', 'orders');
  await expect(main.getByText('You have no active orders.')).toBeVisible();
  await expect(main.getByText('Preparing', { exact: true })).toHaveCount(0);
  await accountSection(page, 'Order history', 'history');
  await expect(main.getByText('No past orders yet.')).toBeVisible();
  await expect(main.getByRole('button', { name: /^Reorder/ })).toHaveCount(0);

  // Profile: validated on the device first, then saved to the account and read back after a reload.
  await accountSection(page, 'Edit profile', 'profile');
  const fullName = main.getByLabel('Full name');
  await expect(fullName).toHaveValue('Minh Test');
  await expect(main.getByLabel('Email address')).toHaveValue('minh.test@example.com');
  await fullName.fill('');
  await main.getByRole('button', { name: 'Save profile' }).click();
  await expect(fullName).toBeFocused();
  await expect(fullName).toHaveAttribute('aria-invalid', 'true');
  await expect(main.getByRole('alert')).toHaveText('Enter a name of 1–80 characters.');
  expect(backend.sent('PATCH', '/api/account/me/')).toEqual([]);
  await fullName.fill('Lan Test');
  await expect(fullName).toHaveAttribute('aria-invalid', 'false');
  await main.getByRole('radio', { name: 'Espresso' }).check();
  await main.getByRole('button', { name: 'Save profile' }).click();
  await expect(main.getByRole('status')).toContainText('Profile saved');
  expect(backend.sent('PATCH', '/api/account/me/')).toEqual([
    { id: backend.state.account.id, name: 'Lan Test', email: 'minh.test@example.com', phone: '', avatar: 'espresso' },
  ]);
  await expect(main.getByText(/Welcome, Lan Test\./)).toBeVisible();
  await expect(main.locator('.dashboard-identity .dashboard-avatar')).toHaveAttribute('data-tone', 'espresso');
  await page.reload();
  await expect(fullName).toHaveValue('Lan Test');
  await expect(main.getByRole('radio', { name: 'Espresso' })).toBeChecked();
  await fullName.fill('Discard me');
  await main.getByRole('button', { name: 'Cancel edits' }).click();
  await expect(fullName).toHaveValue('Lan Test');
  await expect(main.getByRole('status')).toHaveText('Edits discarded.');
  expect(requests('PATCH', '/api/account/me/')).toBe(1);

  await accountSection(page, 'Reservations', 'reservations');
  await expect(main.getByText('No upcoming reservations.')).toBeVisible();
  await main.getByRole('button', { name: 'Past', exact: true }).click();
  await expect(main.getByText('No past reservations.')).toBeVisible();

  // Favourites: the heart on the menu saves to the account, and the account page reads it from there.
  const favoriteLoads = requests('GET', '/api/account/favorites/');
  await page.goto('/menu/');
  await expect.poll(() => requests('GET', '/api/account/favorites/')).toBe(favoriteLoads + 1);
  const heart = main.getByRole('button', { name: 'Favorite Chilli Eggs', exact: true });
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => backend.state.favorites).toEqual([CHILLI_EGGS_ID]);
  // Without the device's own copy, only the account can say which dish was saved.
  await page.evaluate((key) => window.localStorage.removeItem(key), FAVORITES_KEY);
  await page.goto('/account/#favorites');
  const saved = main.getByRole('list', { name: 'Saved menu items' });
  await expect(saved.getByRole('listitem')).toHaveCount(1);
  await expect(saved.getByRole('heading', { name: 'Chilli Eggs' })).toBeVisible();
  await expect(saved.getByRole('button', { name: 'Favorite Chilli Eggs' })).toHaveAttribute('aria-pressed', 'true');
  await capture('account-saved-favorite');
  await saved.getByRole('button', { name: 'Add one Chilli Eggs' }).click();
  await expect(page.getByRole('button', { name: 'Shopping bag, 1 item', exact: true })).toBeVisible();
  await expect.poll(() => backend.state.cart).toEqual({ [CHILLI_EGGS]: 1 });
  await saved.getByRole('button', { name: 'Favorite Chilli Eggs' }).click();
  await expect(main.getByText('No favorite dishes yet.')).toBeVisible();
  await expect.poll(() => backend.state.favorites).toEqual([]);

  // Preferences: the example-orders switch is gone; the compact layout is saved to the account.
  await accountSection(page, 'Preferences', 'preferences');
  await expect(main.getByText('Your display preferences sync with your account.')).toBeVisible();
  await expect(main.getByRole('checkbox', { name: /example orders/i })).toHaveCount(0);
  const compact = main.getByRole('checkbox', { name: /Compact dashboard/ });
  await expect(main.locator('.dashboard-shell')).toHaveAttribute('data-compact', 'false');
  await compact.check();
  await expect(main.locator('.dashboard-shell')).toHaveAttribute('data-compact', 'true');
  await expect.poll(() => backend.state.preferences).toEqual({ compact: true });
  expect(backend.sent('PATCH', '/api/account/preferences/')).toEqual([{ compact: true }]);

  // Orders and table requests appear only once the account really has them.
  backend.state.orders = [ACTIVE_ORDER, PAST_ORDER];
  backend.state.reservations = [UPCOMING_TABLE, PAST_TABLE];
  await page.reload();
  await expect(compact).toBeChecked();
  await expect(main.locator('.dashboard-shell')).toHaveAttribute('data-compact', 'true');

  await accountSection(page, 'Active orders', 'orders');
  await expect(main.getByText('Demo Preview · Example orders')).toHaveCount(0);
  await expect(main.getByText('Pickup orders · Payment is due at the venue.')).toBeVisible();
  const activeOrder = main.locator('details.dashboard-order');
  await expect(activeOrder).toHaveCount(1);
  await expect(activeOrder.locator('summary')).toContainText('20 Nov 2026');
  await expect(activeOrder.locator('summary').getByText('Preparing', { exact: true })).toBeVisible();
  await main.getByText('Order 5D0E7A1C', { exact: true }).click();
  await expect(activeOrder).toHaveAttribute('open', '');
  await expect(activeOrder.getByRole('listitem').filter({ hasText: '1 × Chilli Eggs' })).toContainText('$21.90');
  await expect(activeOrder.getByRole('listitem').filter({ hasText: '1 × Cafe Latte' })).toContainText('$4.90');
  await expect(activeOrder.locator('.dashboard-order-total')).toHaveText('Order total$26.80 AUD');
  await expect(main.getByRole('button', { name: /^Reorder/ })).toHaveCount(0);
  await capture('account-example-timeline');

  await accountSection(page, 'Order history', 'history');
  const pastOrder = main.locator('details.dashboard-order');
  await expect(pastOrder).toHaveCount(1);
  await expect(pastOrder.locator('summary')).toContainText('12 Nov 2026');
  await expect(pastOrder.locator('summary').getByText('Completed', { exact: true })).toBeVisible();
  await main.getByText('Order 9C4B2E7F', { exact: true }).click();
  await expect(pastOrder.getByRole('listitem').filter({ hasText: '2 × Cafe Latte' })).toContainText('$9.80');
  await expect(pastOrder.getByText('Order total', { exact: true })).toBeVisible();
  await expect(pastOrder.locator('.dashboard-order-total')).toHaveText('Order total$31.70 AUD');
  await capture('account-example-history');
  // Reordering adds the order's lines to the Chilli Eggs already in the bag (2 × $21.90 + 2 × $4.90).
  const reorder = pastOrder.getByRole('button', { name: /^Reorder/ });
  await reorder.click();
  const bag = page.getByRole('dialog', { name: 'Your bag' });
  await expect(bag.getByText('Chilli Eggs', { exact: true })).toBeVisible();
  await expect(bag.getByText('Cafe Latte', { exact: true })).toBeVisible();
  await expect(bag.getByTestId('cart-subtotal')).toHaveText('$53.60 AUD');
  await expect(bag.getByRole('button', { name: 'Send pickup order' })).toBeEnabled();
  await expect.poll(() => backend.state.cart).toEqual({ [CHILLI_EGGS]: 2, [CAFE_LATTE]: 2 });
  await bag.getByRole('button', { name: 'Close shopping bag' }).click();
  await expect(reorder).toBeFocused();

  await accountSection(page, 'Reservations', 'reservations');
  const period = main.getByRole('group', { name: 'Reservation period' });
  await expect(period.getByRole('button', { name: 'Upcoming', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(main.getByText('15 Jan 2099 · 18:30', { exact: true })).toBeVisible();
  await expect(main.getByText('4 guests · Confirmed')).toBeVisible();
  await expect(main.getByText('7 Mar 2020 · 09:00', { exact: true })).toHaveCount(0);
  await period.getByRole('button', { name: 'Past', exact: true }).click();
  await expect(period.getByRole('button', { name: 'Past', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(main.getByText('7 Mar 2020 · 09:00', { exact: true })).toBeVisible();
  await expect(main.getByText('2 guests · Contacted')).toBeVisible();
  await expect(main.getByText('15 Jan 2099 · 18:30', { exact: true })).toHaveCount(0);

  await accountSection(page, 'Overview', 'overview');
  await expect(main.getByText('1 active pickup order.', { exact: true })).toBeVisible();
  await expect(main.getByText('1 completed or cancelled order.', { exact: true })).toBeVisible();
  await expect(main.getByText('2 table requests on your account.', { exact: true })).toBeVisible();
  await expect(main.getByText('No favorite dishes yet.', { exact: true })).toBeVisible();

  expect(backend.unexpected()).toEqual([]);
  expect(errors).toEqual([]);
});

test('editorial menu and anchored filter preserve category and real price choices', async ({ page }) => {
  await mockBackend(page);
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

  // A printed row: name, dotted leader, price on one line, with the description beneath.
  const row = main.locator('.lane-menu-item[data-item-id="brunch-chilli-eggs"]');
  const leader = row.locator('.lane-item-leader');
  const price = row.locator('.lane-item-price');
  // The printed menu writes this price "$21.9"; the bag formats the same amount as $21.90.
  await expect(price).toHaveText(/^\$21\.90?$/);
  expect(await leader.evaluate((element) => getComputedStyle(element).borderBottomStyle)).toBe('dotted');
  const nameBox = (await row.getByRole('heading', { name: 'Chilli Eggs', exact: true }).boundingBox())!;
  const leaderBox = (await leader.boundingBox())!;
  const priceBox = (await price.boundingBox())!;
  const descriptionBox = (await row.locator('.lane-item-description').boundingBox())!;
  expect(leaderBox.width).toBeGreaterThan(0);
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(leaderBox.x + 0.5);
  expect(leaderBox.x + leaderBox.width).toBeLessThanOrEqual(priceBox.x + 0.5);
  expect(priceBox.y).toBeLessThan(nameBox.y + nameBox.height);
  expect(descriptionBox.y).toBeGreaterThanOrEqual(
    Math.max(nameBox.y + nameBox.height, priceBox.y + priceBox.height) - 0.5,
  );

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
    // An account with some history, so each captured section shows what a customer would see.
    const backend = await mockAccount(page, {
      favorites: [CHILLI_EGGS_ID],
      orders: [ACTIVE_ORDER, PAST_ORDER],
      reservations: [UPCOMING_TABLE, PAST_TABLE],
    });
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
    await login(page, backend);
    await expect(main.getByText('1 active pickup order.', { exact: true })).toBeVisible();
    await expect(main.getByText('1 saved dish.', { exact: true })).toBeVisible();
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
        if (id === 'orders') await expect(main.getByText('Order 5D0E7A1C', { exact: true })).toBeVisible();
        if (id === 'history') await expect(main.getByText('Order 9C4B2E7F', { exact: true })).toBeVisible();
        if (id === 'profile') await expect(main.getByLabel('Full name')).toHaveValue('Minh Test');
        if (id === 'favorites')
          await expect(
            main.getByRole('list', { name: 'Saved menu items' }).getByRole('heading', { name: 'Chilli Eggs' }),
          ).toBeVisible();
        await capture('account-' + id);
      }
    }
    expect(backend.unexpected()).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('footer curtain settles on a tall display and respects reduced motion', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'This test sets a tall desktop viewport explicitly.');
  await mockBackend(page);
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
  const top = footer.getByRole('link', { name: 'Back to top', exact: true });
  await expect(top).toBeInViewport();
  await expect(top).toHaveAttribute('href', '#main');
  await expect(footer.getByRole('link', { name: 'Back to content' })).toHaveCount(0);
  await expect(footer.getByRole('link', { name: 'Back to the Lumi Lane homepage' })).toHaveText('LUMI LANE');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(y).toBe(0);
});
