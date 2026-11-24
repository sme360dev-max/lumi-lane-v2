import { expect, test, type Page, type Request } from '@playwright/test';
import { API_ORIGIN, LOYALTY_PROGRAM, mockBackend, type MockHandlers, type MockResponse } from './support/backend';

/** Where the site keeps the account token for the tab (src/lib/api.ts). */
const TOKEN_KEY = 'lumi-lane-account-token-v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WRITES = ['POST', 'PUT', 'PATCH', 'DELETE'];

interface Account {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: 'clay' | 'espresso';
}
type Bag = Record<string, number>;

/**
 * The signed-in half of the venue API, shaped as backend/accounts/views.py answers it. Like the
 * real service it answers 401 unless the request carries this account's bearer token, and it
 * remembers the bag it was last sent.
 */
function accountApi(account: Account, token: string, saved: { bag?: Bag; rewardCents?: number } = {}): MockHandlers {
  let bag: Bag = saved.bag ?? {};
  const rewards = {
    program: LOYALTY_PROGRAM,
    points: 0,
    rewardBalanceCents: saved.rewardCents ?? 0,
    entries: [],
  };
  const signedIn = (answer: (request: Request) => MockResponse) => (request: Request) =>
    request.headers()['authorization'] === `Bearer ${token}`
      ? answer(request)
      : { status: 401, body: { error: 'Sign in to continue.' } };
  const cart = () => ({ body: { items: bag, lines: [] } });
  return {
    'GET /api/account/me/': signedIn(() => ({ body: { account } })),
    'GET /api/account/dashboard/': signedIn(() => ({
      body: {
        account,
        preferences: { compact: false, examples: false },
        favorites: [],
        cart: cart().body,
        orders: [],
        reservations: [],
        rewards,
      },
    })),
    'GET /api/account/favorites/': signedIn(() => ({ body: { items: [] } })),
    'GET /api/account/rewards/': signedIn(() => ({ body: rewards })),
    'GET /api/account/cart/': signedIn(cart),
    'PUT /api/account/cart/': signedIn((request) => {
      bag = (request.postDataJSON() as { items: Bag }).items;
      return cart();
    }),
    'DELETE /api/account/cart/': signedIn(() => {
      bag = {};
      return cart();
    }),
    'POST /api/account/logout/': signedIn(() => ({ body: { message: 'Signed out.' } })),
  };
}

/** Every data-changing request the page makes, wherever it is addressed and whether or not it arrives. */
function recordWrites(page: Page) {
  const writes: { call: string; body: unknown }[] = [];
  page.on('request', (request) => {
    if (!WRITES.includes(request.method())) return;
    writes.push({ call: `${request.method()} ${request.url()}`, body: request.postDataJSON() });
  });
  return writes;
}

const api = (call: string) => call.replace(' ', ` ${API_ORIGIN}`);
const storedToken = (page: Page) => page.evaluate((key) => window.sessionStorage.getItem(key), TOKEN_KEY);
const browserStorage = (page: Page) => page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));

test('signing in posts credentials to the account API only, carries the session across pages and signs out', async ({
  page,
}, info) => {
  const account: Account = { id: '7', name: 'Minh Test', email: 'minh.test@example.com', phone: '', avatar: 'clay' };
  const token = 'e2e-session-minh';
  const password = 'LumiTest2026!';
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  const writes = recordWrites(page);
  const seen = await mockBackend(page, {
    ...accountApi(account, token),
    'POST /api/account/login/': (request) =>
      (request.postDataJSON() as { password: string }).password === password
        ? { body: { account, token } }
        : { status: 401, body: { error: 'Email or password is incorrect.' } },
  });
  const calls = (call: string) => seen.filter(({ method, path }) => `${method} ${path}` === call);

  await page.goto('/account/');
  const main = page.getByRole('main');
  await expect(main.getByText('Sign in to view your account details.')).toBeVisible();
  await main.getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/login\/$/);
  const form = main.locator('form.account-form');
  const fill = async (secret: string) => {
    await form.getByLabel('Email address').fill('minh.test@example.com');
    await form.getByLabel('Password', { exact: true }).fill(secret);
    await form.getByRole('button', { name: 'Log in' }).click();
  };
  await fill('wrong-demo-password');
  await expect(form.getByRole('status')).toHaveText('Email or password is incorrect.');
  await expect(page).toHaveURL(/\/login\/$/);
  expect(await storedToken(page)).toBeNull();
  await fill(password);
  await expect(page).toHaveURL(/\/account\/$/);
  await expect(main.getByText(/Welcome, Minh Test/)).toBeVisible();
  expect(calls('POST /api/account/login/').map(({ body }) => body)).toEqual([
    { fullName: '', email: 'minh.test@example.com', password: 'wrong-demo-password' },
    { fullName: '', email: 'minh.test@example.com', password },
  ]);
  expect(await storedToken(page)).toBe(token);
  await expect(main.getByRole('link', { name: /Book a table/ })).toHaveAttribute('href', '/book/');
  await expect(main.getByRole('link', { name: /Loyalty/ })).toHaveAttribute('href', '/loyalty/');
  // A reload has only the stored token to go on: the account comes back from the API.
  expect(calls('GET /api/account/me/')).toHaveLength(0);
  await page.reload();
  await expect(main.getByText(/Welcome, Minh Test/)).toBeVisible();
  expect(calls('GET /api/account/me/')).toHaveLength(1);
  await main.getByRole('link', { name: /Explore menu/ }).click();
  await main.getByRole('button', { name: 'Add one Chilli Eggs', exact: true }).click();
  // The bag of a signed-in guest is saved to their account.
  await expect.poll(() => calls('PUT /api/account/cart/').at(-1)?.body).toEqual({
    items: { 'brunch-chilli-eggs:standard': 1 },
  });

  if (info.project.name === 'desktop-1440') await page.setViewportSize({ width: 1024, height: 820 });
  const header = page.locator('.site-header');
  const toggle = header.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
  else {
    // Left to right: the page links, the centred wordmark, then account and bag, none overlapping.
    const navigation = (await header.locator('.site-nav-list').boundingBox())!;
    const wordmark = (await header.getByRole('link', { name: 'Lumi Lane, home' }).boundingBox())!;
    const actions = (await header.locator('.site-header-actions').boundingBox())!;
    expect(navigation.x + navigation.width).toBeLessThan(wordmark.x);
    expect(wordmark.x + wordmark.width).toBeLessThan(actions.x);
    expect(Math.abs(wordmark.x + wordmark.width / 2 - 512)).toBeLessThan(2);
    await expect(header.getByRole('navigation', { name: 'Account and shopping' }).getByRole('link')).toHaveText(['Account']);
  }
  // Signed in, the header offers the account instead of Log in / Sign up.
  await expect(header.getByRole('link', { name: /Log in|Sign up|Demo account/ })).toHaveCount(0);
  const accountLink = header.getByRole('link', { name: 'Account', exact: true });
  await expect(accountLink).toHaveAttribute('href', '/account/');
  await accountLink.click();
  await expect(page).toHaveURL(/\/account\/$/);
  await main.getByRole('button', { name: /^Shopping bag/ }).click();
  const bag = page.getByRole('dialog', { name: 'Your bag' });
  await expect(bag.getByText('Chilli Eggs', { exact: true })).toBeVisible();
  await expect(bag.getByRole('button', { name: 'Send pickup order' })).toBeEnabled();
  await bag.getByRole('button', { name: 'Close shopping bag' }).click();
  await main.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login\/$/);
  await expect(form.getByLabel('Email address')).toHaveValue('');
  expect(await storedToken(page)).toBeNull();
  const data = await browserStorage(page);
  expect(data).not.toContain(token);
  expect(data).not.toMatch(/lumi-lane-local-demo|minh\.test@example\.com|LumiTest2026/);
  // Credentials travel in the body of the login request and nowhere else: not in an address,
  // not to the site's own host. Every authenticated call above was answered only for the bearer token.
  expect(writes.map(({ call }) => call)).toEqual([
    api('POST /api/account/login/'),
    api('POST /api/account/login/'),
    api('PUT /api/account/cart/'),
    api('POST /api/account/logout/'),
  ]);
  expect(urls.filter((url) => /LumiTest2026|wrong-demo-password|minh\.test|e2e-session/.test(decodeURIComponent(url)))).toEqual([]);
  if (await toggle.isVisible()) await toggle.click();
  await expect(header.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login/');
  await expect(header.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup/');
  await expect(header.getByRole('link', { name: 'Account', exact: true })).toHaveCount(0);
  await page.goto('/account/');
  await expect(main.getByText('Sign in to view your account details.')).toBeVisible();
  expect(calls('GET /api/account/me/')).toHaveLength(1); // signed out, there is no token to check
});

test('account forms validate, report the account service’s answers and keep credentials out of storage', async ({
  page,
}) => {
  const visitor: Account = { id: '12', name: 'Test Visitor', email: 'visitor@example.com', phone: '', avatar: 'clay' };
  const token = 'e2e-session-visitor';
  const secret = 'sample-account-secret';
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  const writes = recordWrites(page);
  const seen = await mockBackend(page, {
    ...accountApi(visitor, token),
    'POST /api/account/register/': (request) =>
      (request.postDataJSON() as { email: string }).email === 'taken@example.com'
        ? {
            status: 409,
            body: {
              error: 'An account with this email already exists.',
              errors: { email: 'This email is already registered.' },
            },
          }
        : { status: 201, body: { account: visitor, token } },
    // The session is ended on this device even when the service cannot confirm it.
    'POST /api/account/logout/': { status: 503 },
  });
  await page.goto('/login/');
  const main = page.getByRole('main');
  const form = main.locator('form.account-form');
  const email = form.getByLabel('Email address');
  const password = form.getByLabel('Password', { exact: true });
  const notice = form.getByRole('status');
  const login = form.getByRole('button', { name: 'Log in' });
  await expect(main.getByText('Your account and account data are saved securely with Lumi Lane.')).toBeVisible();
  await login.click();
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription('Enter your email address.');
  await expect(password).toHaveAttribute('aria-invalid', 'true');
  await expect(password).toHaveAccessibleDescription('Enter your password.');
  await email.fill('invalid');
  await login.click();
  await expect(email).toHaveAccessibleDescription('Enter a valid email address.');
  // Password recovery now opens its own form beside the login form, without disturbing it.
  await main.getByText('Forgot password?', { exact: true }).click();
  const recovery = main.getByRole('region', { name: 'Reset your password' });
  await expect(recovery.getByLabel('Email address')).toBeVisible();
  await expect(recovery.getByRole('button', { name: 'Email me a reset code' })).toBeEnabled();
  await expect(email).toHaveValue('invalid');
  await email.fill('visitor@example.com');
  await expect(email).toHaveAttribute('aria-invalid', 'false');
  await password.fill(secret);
  await main.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await main.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  expect(writes).toEqual([]); // nothing leaves the page until the form is valid

  // The service cannot be reached: the guest is told, stays put and is not signed in.
  const loginCall = `${API_ORIGIN}/api/account/login/`;
  await page.route(loginCall, (route) => route.abort('connectionrefused'));
  await login.click();
  await expect(notice).toHaveText('The account service could not be reached. Please try again.');
  await expect(login).toBeEnabled();
  await expect(page).toHaveURL(/\/login\/$/);
  expect(await storedToken(page)).toBeNull();
  expect(writes).toEqual([
    { call: `POST ${loginCall}`, body: { fullName: '', email: 'visitor@example.com', password: secret } },
  ]);
  await page.unroute(loginCall);
  await email.fill('visitor2@example.com');
  await expect(notice).toBeEmpty(); // editing the form clears the previous answer

  await main.getByRole('link', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/signup\/$/);
  const name = form.getByLabel('Full name');
  const confirm = form.getByLabel('Confirm password', { exact: true });
  const signup = form.getByRole('button', { name: 'Create account' });
  await expect(main.getByText('Forgot password?', { exact: true })).toHaveCount(0);
  await signup.click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAccessibleDescription('Enter your full name.');
  await expect(confirm).toHaveAccessibleDescription('Confirm your password.');
  await name.fill('Test Visitor');
  await email.fill('taken@example.com');
  await password.fill('short');
  await confirm.fill('different');
  await signup.click();
  await expect(password).toBeFocused();
  await expect(password).toHaveAccessibleDescription(/Use at least 8 characters/);
  await expect(confirm).toHaveAccessibleDescription('The passwords must match.');
  await main.getByRole('button', { name: 'Show confirm password' }).click();
  await expect(confirm).toHaveAttribute('type', 'text');
  await main.getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/login\/$/);
  expect(seen.filter(({ method }) => WRITES.includes(method))).toEqual([]); // still nothing has reached the API

  // /register/ is the same sign-up form; from here the service answers.
  await page.goto('/register/');
  await expect(name).toBeVisible();
  await name.fill('Test Visitor');
  await email.fill('taken@example.com');
  await password.fill(secret);
  await confirm.fill(secret);
  await signup.click();
  await expect(notice).toHaveText('An account with this email already exists.');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription('This email is already registered.');
  await expect(signup).toBeEnabled();
  await expect(page).toHaveURL(/\/register\/$/);
  expect(await storedToken(page)).toBeNull();
  await email.fill('visitor@example.com');
  await expect(email).toHaveAttribute('aria-invalid', 'false');
  await expect(notice).toBeEmpty();
  await signup.click();
  await expect(page).toHaveURL(/\/account\/$/);
  await expect(main.getByText(/Welcome, Test Visitor/)).toBeVisible();
  // The confirmation is checked in the browser and never sent.
  expect(seen.filter(({ path }) => path === '/api/account/register/').map(({ body }) => body)).toEqual([
    { fullName: 'Test Visitor', email: 'taken@example.com', password: secret },
    { fullName: 'Test Visitor', email: 'visitor@example.com', password: secret },
  ]);
  // Only the session token is kept, and only for the tab.
  expect(await storedToken(page)).toBe(token);
  const storage = await browserStorage(page);
  expect(storage).not.toMatch(/sample-account-secret|visitor@example\.com|Test Visitor/);
  // With a session, the login and sign-up pages lead straight to the account.
  await page.goto('/login/');
  await expect(page).toHaveURL(/\/account\/$/);
  await expect(main.getByText(/Welcome, Test Visitor/)).toBeVisible();

  await main.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login\/$/);
  await expect(email).toBeVisible();
  expect(await storedToken(page)).toBeNull();
  expect(seen.filter(({ path }) => path === '/api/account/logout/')).toHaveLength(1);
  expect(writes.map(({ call }) => call)).toEqual([
    api('POST /api/account/login/'),
    api('POST /api/account/register/'),
    api('POST /api/account/register/'),
    api('POST /api/account/logout/'),
  ]);
  expect(urls.filter((url) => /sample-account-secret|visitor|e2e-session/.test(decodeURIComponent(url)))).toEqual([]);
});

test('password recovery emails a code, checks the new password and reports the service’s answers', async ({ page }) => {
  const secret = 'new-account-secret';
  const sent = 'If an account exists for that email, a six-digit reset code has been sent.';
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  const writes = recordWrites(page);
  await mockBackend(page, {
    'POST /api/account/password-reset/': { body: { message: sent } },
    'POST /api/account/password-reset/confirm/': (request) =>
      (request.postDataJSON() as { code: string }).code === '654321'
        ? { body: { message: 'Password updated. Please sign in.' } }
        : { status: 400, body: { error: 'This code is invalid or has expired. Check it and try again.' } },
  });
  await page.goto('/login/');
  const main = page.getByRole('main');
  const recovery = main.getByRole('region', { name: 'Reset your password' });
  await expect(recovery).toBeHidden();
  await main.getByText('Forgot password?', { exact: true }).click();
  const notice = recovery.getByRole('status');
  await recovery.getByLabel('Email address').fill('visitor@example.com');
  await recovery.getByRole('button', { name: 'Email me a reset code' }).click();
  // The answer never says whether the address has an account.
  await expect(notice).toHaveText(sent);
  await expect(recovery.getByText('If visitor@example.com is registered, a six-digit code is on its way.')).toBeVisible();
  expect(writes).toEqual([{ call: api('POST /api/account/password-reset/'), body: { email: 'visitor@example.com' } }]);

  const code = recovery.getByLabel('Email code');
  const password = recovery.getByLabel('New password', { exact: true });
  const confirm = recovery.getByLabel('Confirm new password');
  const save = recovery.getByRole('button', { name: 'Set new password' });
  await expect(password).toHaveAttribute('type', 'password');
  await expect(confirm).toHaveAttribute('type', 'password');
  await code.fill('12ab56');
  await expect(code).toHaveValue('1256'); // digits only
  await code.fill('123456');
  await password.fill(secret);
  await confirm.fill('another-account-secret');
  await save.click();
  await expect(notice).toHaveText('The passwords must match.');
  expect(writes).toHaveLength(1); // a mismatch is caught before anything is sent
  await confirm.fill(secret);
  await save.click();
  await expect(notice).toHaveText('This code is invalid or has expired. Check it and try again.');
  await expect(save).toBeEnabled();
  expect(writes[1]).toEqual({
    call: api('POST /api/account/password-reset/confirm/'),
    body: { email: 'visitor@example.com', code: '123456', password: secret },
  });

  await recovery.getByRole('button', { name: 'Send a new code' }).click();
  await expect(notice).toHaveText(sent);
  await expect(code).toHaveValue('');
  expect(writes[2]).toEqual({ call: api('POST /api/account/password-reset/'), body: { email: 'visitor@example.com' } });
  await code.fill('654321');
  await save.click();
  await expect(recovery.getByRole('heading', { name: 'You’re all set.' })).toBeVisible();
  await expect(recovery.getByRole('status')).toHaveText('Password updated. Please sign in.');
  await expect(recovery.getByRole('link', { name: 'Return to log in' })).toHaveAttribute('href', '/login/');
  await expect(save).toHaveCount(0);
  expect(writes[3]).toEqual({
    call: api('POST /api/account/password-reset/confirm/'),
    body: { email: 'visitor@example.com', code: '654321', password: secret },
  });
  expect(writes).toHaveLength(4);
  // Resetting a password does not sign anyone in, and leaves nothing behind in the browser.
  expect(await storedToken(page)).toBeNull();
  expect(await browserStorage(page)).not.toMatch(/account-secret|visitor@example\.com|654321/);
  expect(urls.filter((url) => /account-secret|visitor|654321/.test(decodeURIComponent(url)))).toEqual([]);
});

test('bag stays on the current page, contains focus, locks scrolling and restores position', async ({ page }) => {
  await page.goto('/menu/');
  const trigger = page.locator('.lane-menu-bag');
  await trigger.evaluate((element) => {
    const top = window.scrollY + element.getBoundingClientRect().top - 80;
    window.scrollTo({ top, behavior: 'instant' });
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const before = await page.evaluate(() => window.scrollY);
  const dialog = page.getByRole('dialog', { name: 'Your bag' });
  const close = dialog.getByRole('button', { name: 'Close shopping bag' });
  const continueShopping = dialog.getByRole('button', { name: 'Continue shopping' });
  const movement = await trigger.evaluate((element) => {
    const button = element as HTMLButtonElement;
    button.focus({ preventScroll: true });
    button.click();
    const drawer = document.querySelector<HTMLDialogElement>('.cart-drawer')!;
    const left = drawer.getBoundingClientRect().left;
    return { left, overflow: getComputedStyle(document.documentElement).overflow };
  });
  expect(movement.left).toBeLessThan(0);
  expect(movement.overflow).toBe('hidden');
  await expect(dialog).toBeVisible();
  await expect.poll(async () => Math.abs((await dialog.boundingBox())!.x)).toBeLessThan(1);
  await expect(page).toHaveURL(/\/menu\/$/);
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(continueShopping).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.mouse.wheel(0, 600);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  await trigger.click();
  await expect.poll(async () => Math.abs((await dialog.boundingBox())!.x)).toBeLessThan(1);
  await page.mouse.click(page.viewportSize()!.width - 3, 120);
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.goto('/cart/');
  await expect(page).toHaveURL(/\/menu\/$/);
  await expect(dialog).toBeVisible();
  await close.click();
  await expect(page.locator('#site-bag-trigger')).toBeFocused();
});

test('the bag summary, quantity and Continue shopping stay synchronized with Menu, and a signed-in guest can send the order', async ({
  page,
}) => {
  const account: Account = { id: '7', name: 'Minh Test', email: 'minh.test@example.com', phone: '', avatar: 'clay' };
  const token = 'e2e-session-minh';
  const latte = 'coffee-cafe-latte:standard';
  const note = 'Pickup order request. Payment is due at the venue after confirmation.';
  const writes = recordWrites(page);
  const seen = await mockBackend(page, {
    // The account already holds one latte from another device, and $5.00 of reward credit.
    ...accountApi(account, token, { bag: { [latte]: 1 }, rewardCents: 500 }),
    'POST /api/account/orders/': (request) => {
      if (request.headers()['authorization'] !== `Bearer ${token}`) return { status: 401, body: { error: 'Sign in to continue.' } };
      const { requestId } = request.postDataJSON() as { requestId: string };
      return {
        status: 201,
        body: {
          order: {
            id: requestId,
            date: '2026-08-24',
            createdAt: '2026-08-24T00:30:00+00:00',
            status: 'received',
            statusLabel: 'Received',
            totalCents: 480,
            subtotalCents: 980,
            rewardCents: 500,
            items: [],
          },
          message: 'Order request received. The venue will confirm it; payment is due at pickup.',
        },
      };
    },
  });
  await page.goto('/menu/');
  const menu = page.getByRole('main');
  await menu.getByRole('tab', { name: 'Coffee' }).click();
  const row = menu.locator('[data-item-id="coffee-cafe-latte"]');
  const add = row.getByRole('button', { name: /Add one/ });
  await expect(row.getByRole('button', { name: /Remove one/ })).toBeDisabled();
  await add.click();
  const trigger = page.locator('.lane-menu-bag');
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Your bag' });
  const subtotal = dialog.getByTestId('cart-subtotal');
  const due = dialog.getByRole('paragraph').filter({ hasText: 'Due at pickup' });
  const send = dialog.getByRole('button', { name: 'Send pickup order' });
  await expect(subtotal).toHaveText('$4.90 AUD');
  await expect(due).toContainText('$4.90 AUD');
  await expect(dialog.locator('.cart-line-picture img')).toBeVisible();
  // A guest who is not signed in is sent to log in; there is nothing to send an order with.
  await expect(dialog.getByText(note)).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Log in to order' })).toHaveAttribute('href', '/login/');
  await expect(send).toHaveCount(0);
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await dialog.getByRole('button', { name: /Add one/ }).click();
  await expect(subtotal).toHaveText('$9.80 AUD');
  await expect(due).toContainText('$9.80 AUD');
  await expect(dialog.getByRole('status').last()).toContainText('quantity 2');
  await dialog.getByRole('button', { name: 'Continue shopping' }).click();
  await expect(trigger).toBeFocused();
  await expect(row.locator('output')).toHaveText('2');
  await page.goto('/about/');
  const headerBag = page.getByRole('button', { name: 'Shopping bag, 2 items' });
  await headerBag.click();
  await expect(subtotal).toHaveText('$9.80 AUD');
  await dialog.getByRole('button', { name: /Remove .+ from bag/ }).click();
  await expect(dialog.getByText('Your bag is empty.', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close shopping bag' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Shopping bag', exact: true })).toBeFocused();
  expect(writes).toEqual([]); // a signed-out bag lives on the device only
  expect(seen.filter(({ path }) => path.startsWith('/api/account/'))).toEqual([]);

  // Signed in, the bag follows the account: the device picks up what the account has saved.
  await page.evaluate(([key, value]) => window.sessionStorage.setItem(key!, value!), [TOKEN_KEY, token]);
  await page.goto('/menu/');
  await expect(page.getByRole('button', { name: 'Shopping bag, 1 item', exact: true })).toBeVisible();
  await menu.getByRole('tab', { name: 'Coffee' }).click();
  await expect(row.locator('output')).toHaveText('1');
  await add.click();
  await expect(row.locator('output')).toHaveText('2');
  await expect.poll(() => writes.at(-1)).toEqual({ call: api('PUT /api/account/cart/'), body: { items: { [latte]: 2 } } });
  await trigger.click();
  await expect(subtotal).toHaveText('$9.80 AUD');
  await expect(dialog.getByRole('link', { name: 'Log in to order' })).toHaveCount(0);
  await expect(send).toBeEnabled();
  await expect(send).toHaveAccessibleDescription(note);
  await expect(due).toContainText('$9.80 AUD');
  const credit = dialog.getByRole('checkbox', { name: /Use reward credit/ });
  await expect(credit).toHaveAccessibleName(/\$5\.00 AUD available/);
  await credit.check();
  await expect(dialog.getByRole('paragraph').filter({ hasText: 'Reward credit' })).toContainText('−$5.00 AUD');
  await expect(due).toContainText('$4.80 AUD');
  await expect(subtotal).toHaveText('$9.80 AUD');

  // The order cannot be delivered: the guest is told and the bag is left exactly as it was.
  const orders = `${API_ORIGIN}/api/account/orders/`;
  await page.route(orders, (route) => route.abort('connectionrefused'));
  await send.click();
  await expect(dialog.getByRole('alert')).toHaveText('The account service could not be reached. Please try again.');
  await expect(send).toBeEnabled();
  await expect(subtotal).toHaveText('$9.80 AUD');
  await expect(dialog.getByRole('heading', { name: 'Cafe Latte' })).toBeVisible();
  await page.unroute(orders);
  await send.click();
  await expect(dialog.getByRole('heading', { name: 'Your order request is received.' })).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  // Both tries are one order to the venue: same request id, the credit choice, and no prices from the browser.
  const sent = writes.filter(({ call }) => call === `POST ${orders}`);
  expect(sent).toHaveLength(2);
  expect(sent[0]!.body).toEqual({ requestId: expect.stringMatching(UUID), useReward: true });
  expect(sent[1]).toEqual(sent[0]);
  const reference = (sent[0]!.body as { requestId: string }).requestId.slice(0, 8).toUpperCase();
  await expect(dialog.getByText(`Order ${reference} has been sent to Lumi Lane.`, { exact: false })).toBeVisible();
  await expect(dialog.getByText('payment is due at pickup', { exact: false })).toBeVisible();
  // The order empties the bag everywhere: in the drawer, on the account and on the Menu behind it.
  await expect(subtotal).toHaveCount(0);
  await expect(send).toHaveCount(0);
  await expect.poll(() => writes.at(-1)?.call).toBe(api('DELETE /api/account/cart/'));
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(row.locator('output')).toHaveText('0');
  await expect(row.getByRole('button', { name: /Remove one/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Shopping bag', exact: true })).toBeVisible();
  expect(writes.map(({ call }) => call)).toEqual([
    api('PUT /api/account/cart/'),
    api('POST /api/account/orders/'),
    api('POST /api/account/orders/'),
    api('DELETE /api/account/cart/'),
  ]);
});

test('the footer retains links, hours and factual utility information', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  const wordmark = footer.getByRole('link').first();
  await expect(wordmark).toHaveText('LUMI LANE');
  await expect(wordmark).toHaveAccessibleName('Back to the Lumi Lane homepage');
  await expect(wordmark).toHaveAttribute('href', '/');
  await expect(footer.getByText(/Good coffee|Great company/)).toHaveCount(0);
  await expect(footer.getByRole('img', { name: /Latte art/ })).toHaveCount(0);
  const nav = footer.getByRole('navigation', { name: 'Footer' });
  await expect(nav.getByRole('link')).toHaveText(['About', 'Menu', 'Visit us', 'Book a table', 'Loyalty']);
  await expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about/');
  await expect(nav.getByRole('link', { name: 'Menu' })).toHaveAttribute('href', '/menu/');
  await expect(nav.getByRole('link', { name: 'Visit us' })).toHaveAttribute('href', '/visit/');
  await expect(nav.getByRole('link', { name: 'Book a table' })).toHaveAttribute('href', '/book/');
  await expect(nav.getByRole('link', { name: 'Loyalty' })).toHaveAttribute('href', '/loyalty/');
  const social = footer.getByRole('list', { name: 'Social media' }).getByRole('link');
  await expect(social).toHaveCount(3);
  for (const link of await social.all()) {
    await expect(link).toHaveAccessibleName(/^Lumi Lane on (Instagram|TikTok|Facebook)$/);
    await expect(link).toHaveAttribute('href', /^https:\/\/www\.(instagram|tiktok|facebook)\.com\//);
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
  await expect(footer.getByText('Shop 9, 163/169 Fosters Rd,', { exact: false })).toBeVisible();
  await expect(footer.getByText('7:00am to 4:00pm')).toBeVisible();
  await expect(footer.getByText('8:00am to 4:00pm')).toBeVisible();
  await expect(footer.getByRole('link', { name: '0405 555 442' })).toHaveAttribute('href', 'tel:0405555442');
  const maps = new URL((await footer.getByRole('link', { name: 'Get directions' }).getAttribute('href'))!);
  expect(maps.origin + maps.pathname).toBe('https://www.google.com/maps/dir/');
  expect(maps.searchParams.get('destination')).toBe('Shop 9, 163/169 Fosters Rd, Lightsview SA 5085, Australia');
  await expect(footer.getByText('Privacy Policy', { exact: true })).toBeHidden();
  await footer.getByText('Policies & accessibility', { exact: true }).click();
  await expect(footer.getByText('Privacy Policy', { exact: true })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Privacy Policy' })).toHaveCount(0);
  await expect(footer.getByRole('link', { name: 'Back to content' })).toHaveCount(0);
  await expect(footer.getByRole('link', { name: 'Back to top' })).toHaveAttribute('href', '#main');
});
