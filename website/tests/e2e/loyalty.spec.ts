import { expect, test, type Locator, type Page } from '@playwright/test';
import { LOYALTY_PROGRAM, mockBackend, type MockResponse } from './support/backend';

/** Where the site keeps the account token for the tab (src/lib/api.ts). */
const TOKEN_KEY = 'lumi-lane-account-token-v1';
const TOKEN = 'test-token';
const ACCOUNT = { id: 'acc-1', name: 'Minh Test', email: 'minh.test@example.com', phone: '0400 000 000', avatar: 'clay' };
const ME = { body: { account: ACCOUNT } };

const FAQ = [
  ['How do I earn points?', 'You earn 1 point(s) for every order the venue marks as completed.'],
  ['How many points are needed?', '8 points unlock $20.00 AUD reward credit.'],
  ['How do I use reward credit?', /apply your available reward credit when sending a pickup order request\. Any remaining amount is due at pickup\./],
  ['Do I need an account?', 'Yes. Points and reward credit are attached to your Lumi Lane account.'],
] as const;

/** Signs the tab in before the site's own scripts run; the session is then restored from GET /api/account/me/. */
const signIn = (page: Page) =>
  page.addInitScript(([key, token]) => window.sessionStorage.setItem(key, token), [TOKEN_KEY, TOKEN] as const);

const rewards = (points: number, rewardBalanceCents: number, program: object | null = LOYALTY_PROGRAM): MockResponse => ({
  body: { program, points, rewardBalanceCents, entries: [] },
});

/** A response the test holds back until it has looked at the page as it was served. */
function gate() {
  let open = () => {};
  const opened = new Promise<void>((resolve) => { open = resolve; });
  return { open, opened };
}

function watchPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

const sections = (page: Page) => {
  const main = page.getByRole('main');
  return {
    main,
    intro: main.locator('section').nth(0),
    status: main.getByRole('region', { name: 'Your rewards.' }),
    details: main.locator('section').nth(2),
  };
};

const noHorizontalOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

type StepBox = { left: number; top: number; width: number; height: number };

/** How much of the points track is filled, as a fraction of the track's inner width. */
const fillRatio = (bar: Locator) =>
  bar.evaluate((track) => track.firstElementChild!.getBoundingClientRect().width / track.clientWidth);

/** The anchor target sits fully below the sticky header and inside the viewport. */
async function expectClearOfHeader(page: Page, target: Locator) {
  await expect.poll(async () => {
    const header = (await page.locator('.site-header').boundingBox())!;
    const box = (await target.boundingBox())!;
    return box.y >= header.y + header.height && box.y + box.height <= page.viewportSize()!.height;
  }).toBe(true);
}

test('Coffee Club teaches the points benefit and rules, then answers the FAQ and links onward', async ({ page }) => {
  test.setTimeout(60_000); // several full page loads; the default is tight on a busy machine
  const errors = watchPageErrors(page);
  const seen = await mockBackend(page);
  await page.goto('/loyalty/');
  await expect(page).toHaveTitle(/Loyalty/);
  const main = page.getByRole('main');
  const intro = main.getByRole('region', { name: '8 points. $20.00 credit.' });
  const status = main.getByRole('region', { name: 'Your rewards.' });
  const details = main.getByRole('region', { name: '$20.00 AUD credit.' });
  await expect(main.getByRole('region')).toHaveText([
    /Lumi Lane rewards[\s\S]+How Coffee Club Works/,
    /^Your Coffee Club\s*Your rewards\./,
    /\$20\.00 AUD credit\.[\s\S]+Coffee Club FAQ/,
  ]);
  await expect(status).toBeVisible();

  // The promise, then the three steps, in the order a guest meets them.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('8 points. $20.00 credit.');
  await expect(intro.getByText('Earn 1 point(s) when each order is completed. Use reward credit on a future pickup order.')).toBeVisible();
  await expect(intro.getByText('Rules are managed by Lumi Lane.')).toBeVisible();
  const steps = intro.getByRole('list');
  await expect(steps.getByRole('listitem')).toHaveCount(3);
  await expect(steps.getByRole('heading', { level: 3 })).toHaveText(['Place an order', 'Earn points', 'Unlock credit']);
  await expect(steps.getByRole('paragraph')).toHaveText([
    'Order with your Lumi Lane account.',
    'Receive 1 point(s) when your order is completed.',
    '8 points unlock $20.00 AUD reward credit.',
  ]);
  // Step icons and the coffee photograph are decoration: nothing for a screen reader to announce.
  await expect(steps.locator('svg[aria-hidden="true"]')).toHaveCount(3);
  await expect(intro.getByRole('img')).toHaveCount(0);
  await expect(intro.getByRole('link', { name: 'View your rewards' })).toHaveAttribute('href', '/account/#rewards');

  // The way onward: both links leave the page and Back returns to the guide.
  const links = details.getByRole('navigation', { name: 'Explore Lumi Lane after Coffee Club' });
  await expect(links.getByRole('link')).toHaveText(['Explore the menu', 'Visit Us']);
  await expect(links.getByRole('link', { name: 'Explore the menu' })).toHaveAttribute('href', '/menu/');
  await expect(links.getByRole('link', { name: 'Visit Us' })).toHaveAttribute('href', '/visit/');
  await links.getByRole('link', { name: 'Visit Us' }).click();
  await expect(page).toHaveURL(/\/visit\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Visit us.');
  await page.goBack();
  await expect(page).toHaveURL(/\/loyalty\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('8 points. $20.00 credit.');
  await links.getByRole('link', { name: 'Explore the menu' }).click();
  await expect(page).toHaveURL(/\/menu\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The menu.');
  await page.goBack();
  await expect(page).toHaveURL(/\/loyalty\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('8 points. $20.00 credit.');

  // The in-page anchor works from the keyboard, moves focus, and lands below the sticky header.
  const explore = intro.getByRole('link', { name: 'Explore Coffee Club' });
  await expect(explore).toHaveAttribute('href', '#coffee-club-how');
  await explore.press('Enter');
  await expect(page).toHaveURL(/#coffee-club-how$/);
  const how = intro.getByRole('heading', { level: 2, name: 'How Coffee Club Works' });
  await expect(how).toBeFocused();
  await expectClearOfHeader(page, how);
  // Once the entrance has played, every step rests fully opaque and untransformed.
  await expect.poll(() => steps.getByRole('listitem').evaluateAll((items) => items.map((item) => {
    const style = getComputedStyle(item);
    return `${style.opacity} ${style.transform}`;
  }))).toEqual(['1 none', '1 none', '1 none']);

  // The reward explained, then every FAQ answer behind a keyboard-operable disclosure.
  await expect(details.getByRole('heading', { level: 2 })).toHaveText(['$20.00 AUD credit.', 'Coffee Club FAQ']);
  await expect(details.getByText('Complete 8 points to add reward credit to your Lumi Lane account.')).toBeVisible();
  await expect(details.locator('summary')).toHaveText(FAQ.map(([question]) => question));
  for (const [question, answer] of FAQ) {
    const row = details.locator('details').filter({ has: page.getByText(question, { exact: true }) });
    await expect(row).toHaveJSProperty('open', false);
    await expect(row.getByRole('paragraph')).toBeHidden();
    await row.locator('summary').press('Enter');
    await expect(row).toHaveJSProperty('open', true);
    await expect(row.getByRole('paragraph')).toBeVisible();
    await expect(row.getByRole('paragraph')).toHaveText(answer);
  }
  // Rows are independent (the earlier answers stay open) and each one closes again.
  await expect(details.locator('details[open]')).toHaveCount(FAQ.length);
  const first = details.locator('details').first();
  await first.locator('summary').press('Space');
  await expect(first).toHaveJSProperty('open', false);
  await expect(first.getByRole('paragraph')).toBeHidden();
  await expect(details.locator('details[open]')).toHaveCount(FAQ.length - 1);
  await noHorizontalOverflow(page);
  // With the anchor in the address the onward links still leave the page.
  await links.getByRole('link', { name: 'Explore the menu' }).click();
  await expect(page).toHaveURL(/\/menu\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The menu.');

  // Reading the page asks the venue for the programme and never submits anything.
  expect(seen.some((request) => request.method === 'GET' && request.path === '/api/loyalty/')).toBe(true);
  expect(seen.filter((request) => request.method !== 'GET')).toEqual([]);
  expect(errors).toEqual([]);
});

test('signed-out visitors are offered Log in and Create account, and a rejected token is dropped', async ({ page }) => {
  test.setTimeout(60_000); // several full page loads; the default is tight on a busy machine
  const errors = watchPageErrors(page);
  const seen = await mockBackend(page, {
    'GET /api/account/me/': { status: 401, body: { error: 'Authentication required.' } },
  });
  await page.goto('/loyalty/');
  const { status } = sections(page);
  await expect(status.getByText('Your Coffee Club', { exact: true })).toBeVisible();
  await expect(status.getByRole('heading', { level: 2 })).toHaveText('Your rewards.');
  await expect(status.getByText('Sign in to see your points and available reward credit.')).toBeVisible();
  await expect(status.getByRole('link')).toHaveText(['Log in', 'Create account']);
  await expect(status.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login/');
  await expect(status.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/signup/');
  await expect(status.getByRole('progressbar')).toHaveCount(0);
  await expect(status.getByText(/points toward|Available reward credit|Loading your points/)).toHaveCount(0);
  // Without a token the account service is never asked about this visitor.
  await expect.poll(() => seen.some((request) => request.path === '/api/loyalty/')).toBe(true);
  expect(seen.filter((request) => request.path.startsWith('/api/account/'))).toEqual([]);

  // Both invitations work, from the keyboard and by pointer, and Back returns to the same panel.
  await status.getByRole('link', { name: 'Log in' }).press('Enter');
  await expect(page).toHaveURL(/\/login\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/loyalty\/$/);
  await status.getByRole('link', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/signup\/$/);
  await page.goBack();
  await expect(status.getByText('Sign in to see your points and available reward credit.')).toBeVisible();

  // A token the venue no longer accepts leaves the visitor signed out and is removed from the tab.
  await page.evaluate(([key, token]) => window.sessionStorage.setItem(key, token), [TOKEN_KEY, 'expired-token'] as const);
  seen.length = 0;
  await page.reload();
  await expect.poll(() => seen.filter((request) => request.path === '/api/account/me/').length).toBe(1);
  await expect.poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), TOKEN_KEY)).toBeNull();
  await expect(status.getByText('Sign in to see your points and available reward credit.')).toBeVisible();
  await expect(status.getByRole('link')).toHaveText(['Log in', 'Create account']);
  await expect(status.getByRole('progressbar')).toHaveCount(0);
  expect(seen.filter((request) => request.path === '/api/account/rewards/')).toEqual([]);
  expect(seen.filter((request) => request.method !== 'GET')).toEqual([]);
  expect(errors).toEqual([]);
});

test('a signed-in member sees points progress, reward credit and a fresh cycle, read-only', async ({ page }) => {
  test.setTimeout(60_000); // several full page loads; the default is tight on a busy machine
  const errors = watchPageErrors(page);
  const authorization: (string | undefined)[] = [];
  const hold = gate();
  let balance = rewards(5, 2000);
  await signIn(page);
  const seen = await mockBackend(page, {
    'GET /api/account/me/': (request) => {
      authorization.push(request.headers().authorization);
      return ME;
    },
    'GET /api/account/rewards/': async (request) => {
      authorization.push(request.headers().authorization);
      await hold.opened;
      return balance;
    },
  });
  await page.goto('/loyalty/');
  const { status } = sections(page);
  const bar = status.getByRole('progressbar', { name: 'Points toward reward' });

  // Until the balance arrives the panel says so, and already swaps the sign-in links for the account link.
  await expect(status.getByText('Loading your points and reward balance…')).toBeVisible();
  await expect(bar).toHaveCount(0);
  await expect(status.getByRole('link')).toHaveText(['Open account rewards']);
  hold.open();

  await expect(status.getByText('5 of 8 points toward $20.00 AUD reward credit.')).toBeVisible();
  await expect(status.getByText('Loading your points and reward balance…')).toHaveCount(0);
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuemin', '0');
  await expect(bar).toHaveAttribute('aria-valuemax', '8');
  await expect(bar).toHaveAttribute('aria-valuenow', '5');
  await expect.poll(() => fillRatio(bar)).toBeCloseTo(5 / 8, 2);
  await expect(status.getByText('Available reward credit: $20.00 AUD. Points are added after an order is completed.')).toBeVisible();
  await expect(status.locator('strong')).toHaveText('$20.00 AUD');
  await expect(status.getByRole('link')).toHaveText(['Open account rewards']);
  await expect(status.getByRole('link', { name: 'Open account rewards' })).toHaveAttribute('href', '/account/#rewards');
  await expect(status.getByText('Sign in to see your points and available reward credit.')).toHaveCount(0);
  // The public guide above is unchanged by signing in.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('8 points. $20.00 credit.');
  await noHorizontalOverflow(page);

  // The session was restored once, and every account read carried the tab's token.
  expect(seen.filter((request) => request.path === '/api/account/me/')).toHaveLength(1);
  expect(seen.filter((request) => request.path === '/api/account/rewards/').length).toBeGreaterThanOrEqual(1);
  expect(authorization.length).toBeGreaterThanOrEqual(2);
  expect([...new Set(authorization)]).toEqual([`Bearer ${TOKEN}`]);

  // After a reward is issued the venue reports a new cycle: an empty bar and more credit.
  balance = rewards(0, 4000);
  await page.reload();
  await expect(status.getByText('0 of 8 points toward $20.00 AUD reward credit.')).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuenow', '0');
  await expect(bar).toHaveAttribute('aria-valuemax', '8');
  await expect.poll(() => fillRatio(bar)).toBe(0);
  await expect(status.locator('strong')).toHaveText('$40.00 AUD');

  // One point short of the reward fills seven eighths of the track, never more than the track.
  balance = rewards(7, 4000);
  await page.reload();
  await expect(status.getByText('7 of 8 points toward $20.00 AUD reward credit.')).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuenow', '7');
  await expect.poll(() => fillRatio(bar)).toBeCloseTo(7 / 8, 2);

  // Looking at the status never writes to the venue.
  expect(seen.filter((request) => request.method !== 'GET')).toEqual([]);
  expect(errors).toEqual([]);
});

test('programme numbers and the paused state come from the venue API in every section', async ({ page }) => {
  test.setTimeout(60_000); // several full page loads; the default is tight on a busy machine
  const errors = watchPageErrors(page);
  const custom = { active: true, pointsPerOrder: 2, pointsForReward: 12, rewardCents: 3550 };
  const hold = gate();
  let program: MockResponse = { body: custom };
  let balance = rewards(9, 7100, custom);
  await signIn(page);
  await mockBackend(page, {
    'GET /api/loyalty/': async () => {
      await hold.opened;
      return program;
    },
    'GET /api/account/me/': ME,
    'GET /api/account/rewards/': () => balance,
  });
  await page.goto('/loyalty/');
  const { main, intro, status, details } = sections(page);
  const heading = page.getByRole('heading', { level: 1 });
  const stepCopy = intro.getByRole('list').getByRole('paragraph');
  const answers = details.locator('details p');
  const bar = status.getByRole('progressbar', { name: 'Points toward reward' });

  // The page is served with the default programme and stays on it until the venue answers.
  await expect(heading).toHaveText('8 points. $20.00 credit.');
  await expect(details.getByRole('heading', { level: 2 }).first()).toHaveText('$20.00 AUD credit.');
  hold.open();

  // A programme that differs from the bundle replaces every number: heading, promise, steps, reward and FAQ.
  await expect(heading).toHaveText('12 points. $35.50 credit.');
  await expect(main.getByRole('region', { name: '12 points. $35.50 credit.' })).toBeVisible();
  await expect(intro.getByText('Earn 2 point(s) when each order is completed. Use reward credit on a future pickup order.')).toBeVisible();
  await expect(stepCopy).toHaveText([
    'Order with your Lumi Lane account.',
    'Receive 2 point(s) when your order is completed.',
    '12 points unlock $35.50 AUD reward credit.',
  ]);
  await expect(main.getByRole('region', { name: '$35.50 AUD credit.' })).toBeVisible();
  await expect(details.getByText('Complete 12 points to add reward credit to your Lumi Lane account.')).toBeVisible();
  await expect(answers).toHaveText([
    'You earn 2 point(s) for every order the venue marks as completed.',
    '12 points unlock $35.50 AUD reward credit.',
    FAQ[2][1],
    FAQ[3][1],
  ]);
  // The member's own progress is measured against the same programme.
  await expect(status.getByText('9 of 12 points toward $35.50 AUD reward credit.')).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuemax', '12');
  await expect(bar).toHaveAttribute('aria-valuenow', '9');
  await expect.poll(() => fillRatio(bar)).toBeCloseTo(9 / 12, 2);
  await expect(status.locator('strong')).toHaveText('$71.00 AUD');
  // No default figure is left anywhere on the page.
  await expect(main).not.toContainText(/\$20\.00|\b8 points|\b1 point\(s\)/);
  await noHorizontalOverflow(page);

  // Paused by the venue: the promise is replaced, the rules stay readable, the member's bar is withdrawn.
  program = { body: { ...custom, active: false } };
  balance = rewards(9, 7100, { ...custom, active: false });
  await page.reload();
  await expect(intro.getByText('The loyalty program is currently paused.')).toBeVisible();
  await expect(intro.getByText(/Earn \d+ point\(s\) when each order is completed/)).toHaveCount(0);
  await expect(heading).toHaveText('12 points. $35.50 credit.');
  await expect(stepCopy).toHaveCount(3);
  await expect(intro.getByRole('link', { name: 'Explore Coffee Club' })).toBeVisible();
  await expect(details.locator('summary')).toHaveText(FAQ.map(([question]) => question));
  await expect(status.getByText('The loyalty program is temporarily paused.')).toBeVisible();
  await expect(bar).toHaveCount(0);
  await expect(status.getByText(/points toward|Available reward credit|Loading your points/)).toHaveCount(0);
  await expect(status.getByRole('link')).toHaveText(['Open account rewards']);
  await noHorizontalOverflow(page);

  // No programme configured for the member at all reads as paused too, never as a broken bar.
  balance = rewards(0, 0, null);
  await page.reload();
  await expect(status.getByText('The loyalty program is temporarily paused.')).toBeVisible();
  await expect(bar).toHaveCount(0);

  // If the venue cannot be reached the guide keeps the bundled programme, and the member panel settles.
  program = { status: 503, body: { error: 'Unavailable' } };
  balance = { status: 503, body: { error: 'Unavailable' } };
  await page.reload();
  await expect(status.getByRole('link')).toHaveText(['Open account rewards']);
  await expect(status.getByText('Loading your points and reward balance…')).toHaveCount(0);
  await expect(bar).toHaveCount(0);
  await expect(heading).toHaveText('8 points. $20.00 credit.');
  await expect(intro.getByText('Earn 1 point(s) when each order is completed. Use reward credit on a future pickup order.')).toBeVisible();
  await expect(stepCopy).toHaveText([
    'Order with your Lumi Lane account.',
    'Receive 1 point(s) when your order is completed.',
    '8 points unlock $20.00 AUD reward credit.',
  ]);
  await expect(details.getByRole('heading', { level: 2 }).first()).toHaveText('$20.00 AUD credit.');
  expect(errors).toEqual([]);
});

test('reduced motion keeps the steps still and every part of the page reachable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);
  await mockBackend(page, { 'GET /api/account/me/': ME, 'GET /api/account/rewards/': rewards(7, 2000) });
  await page.goto('/loyalty/');
  const { intro, status, details } = sections(page);
  const steps = intro.getByRole('list').getByRole('listitem');
  const stepStyles = () => steps.evaluateAll((items) => items.map((item) => {
    const style = getComputedStyle(item);
    return `${style.opacity} ${style.transform} ${item.getAttribute('style') ?? ''}`.trim();
  }));
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');

  // The anchor jumps straight to the steps, which are never faded or shifted on the way in.
  await intro.getByRole('link', { name: 'Explore Coffee Club' }).press('Enter');
  await expect(page).toHaveURL(/#coffee-club-how$/);
  const how = intro.getByRole('heading', { level: 2, name: 'How Coffee Club Works' });
  await expect(how).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expectClearOfHeader(page, how);
  await expect(steps).toHaveCount(3);
  for (let frame = 0; frame < 6; frame++) {
    expect(await stepStyles()).toEqual(['1 none', '1 none', '1 none']);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  }
  await expect(steps.getByRole('heading', { level: 3 })).toHaveText(['Place an order', 'Earn points', 'Unlock credit']);

  // Progress, credit and the account link are all still there.
  const bar = status.getByRole('progressbar', { name: 'Points toward reward' });
  await expect(status.getByText('7 of 8 points toward $20.00 AUD reward credit.')).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuenow', '7');
  await expect.poll(() => fillRatio(bar)).toBeCloseTo(7 / 8, 2);
  await expect(status.locator('strong')).toHaveText('$20.00 AUD');
  await expect(status.getByRole('link', { name: 'Open account rewards' })).toBeVisible();

  // So are the answers and the way onward.
  const last = details.locator('details').last();
  await last.locator('summary').press('Enter');
  await expect(last.getByRole('paragraph')).toBeVisible();
  await expect(last.getByRole('paragraph')).toHaveText(FAQ[3][1]);
  await noHorizontalOverflow(page);
  await details.getByRole('link', { name: 'Explore the menu' }).click();
  await expect(page).toHaveURL(/\/menu\/$/);
});

test('guide, status and FAQ keep their layout at this viewport and through a resize', async ({ page }) => {
  test.setTimeout(60_000); // nine layouts measured in one visit; the default is tight on a busy machine
  await signIn(page);
  await mockBackend(page, { 'GET /api/account/me/': ME, 'GET /api/account/rewards/': rewards(5, 2000) });
  await page.goto('/loyalty/');
  const viewport = page.viewportSize()!;
  const { main, intro, status, details } = sections(page);
  const bar = status.getByRole('progressbar', { name: 'Points toward reward' });
  await expect(bar).toBeVisible();

  /** Page-space boxes of everything the layout promises; steps use offsets, which their entrance transform cannot move. */
  const measure = () => page.evaluate(() => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left + window.scrollX, right: rect.right + window.scrollX, top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY };
    };
    const [introSection, statusSection, detailsSection] = [...document.querySelectorAll('main > section')] as [Element, Element, Element];
    const steps = [...introSection.querySelectorAll<HTMLElement>('ol > li')];
    const header = document.querySelector('.site-header')!.getBoundingClientRect();
    return {
      width: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      header: { top: header.top, height: header.height, position: getComputedStyle(document.querySelector('.site-header')!).position },
      heading: box(introSection.querySelector('h1')!),
      coffee: box(introSection.querySelector('img')!),
      steps: steps.map((step) => ({ left: step.offsetLeft, top: step.offsetTop, width: step.offsetWidth, height: step.offsetHeight })),
      guide: box(introSection),
      status: box(statusSection),
      details: box(detailsSection),
      track: box(statusSection.querySelector('[role="progressbar"]')!),
      reward: box(detailsSection.querySelector('h2')!),
      faq: box(detailsSection.querySelector('details')!),
      controls: [...document.querySelectorAll('main a, main summary')].map(box),
      text: [...document.querySelectorAll('main h1, main h2, main h3, main p:not(details p)')].map(box),
    };
  });

  async function expectLayout(width: number) {
    const layout = await measure();
    expect(layout.overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
    expect(layout.width).toBeLessThanOrEqual(width);
    expect(layout.header.position).toBe('sticky');
    expect(Math.round(layout.header.height)).toBe(72);

    // Nothing readable or operable is clipped by the edge of the screen.
    for (const item of [...layout.text, ...layout.controls, layout.coffee, layout.track]) {
      expect(item.left, `left edge at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(item.right, `right edge at ${width}px`).toBeLessThanOrEqual(layout.width + 0.5);
      expect(item.right - item.left).toBeGreaterThan(0);
    }
    // The three sections stack in reading order with no gap or overlap between them.
    expect(layout.guide.bottom).toBeCloseTo(layout.status.top, 0);
    expect(layout.status.bottom).toBeCloseTo(layout.details.top, 0);

    // Steps: three across, or one under the other on a phone. Never overlapping, never orphaned.
    expect(layout.steps).toHaveLength(3);
    const [one, two, three] = layout.steps as [StepBox, StepBox, StepBox];
    if (width > 580) {
      expect(two.top).toBe(one.top);
      expect(three.top).toBe(one.top);
      expect(two.left).toBeGreaterThanOrEqual(one.left + one.width);
      expect(three.left).toBeGreaterThanOrEqual(two.left + two.width);
    } else {
      expect(two.left).toBe(one.left);
      expect(three.left).toBe(one.left);
      expect(two.top).toBeGreaterThanOrEqual(one.top + one.height);
      expect(three.top).toBeGreaterThanOrEqual(two.top + two.height);
    }
    // Opening: the cup sits beside the promise when there is room, under it when there is not.
    if (width > 740) {
      expect(layout.coffee.left).toBeGreaterThanOrEqual(layout.heading.right - 0.5);
      expect(layout.faq.left).toBeGreaterThanOrEqual(layout.reward.right - 0.5);
    } else {
      expect(layout.coffee.top).toBeGreaterThanOrEqual(layout.heading.bottom);
      expect(layout.faq.top).toBeGreaterThanOrEqual(layout.reward.bottom);
    }
    // The points track is capped at 38rem and every link and FAQ row is a comfortable target.
    expect(layout.track.right - layout.track.left).toBeLessThanOrEqual(608.5);
    for (const control of layout.controls) expect(control.bottom - control.top, `tap target at ${width}px`).toBeGreaterThanOrEqual(44);
    expect(await fillRatio(bar)).toBeCloseTo(5 / 8, 2);
  }

  await expect.poll(() => fillRatio(bar)).toBeCloseTo(5 / 8, 2);
  await expectLayout(viewport.width);

  // Either side of both breakpoints, plus the narrowest phone and a wide desktop.
  for (const width of [320, 580, 581, 740, 741, 1024, 1920]) {
    await page.setViewportSize({ width, height: viewport.height });
    await expectLayout(width);
  }

  // Back at the project's own size the page is as it was, and the anchor still clears the header.
  await page.setViewportSize(viewport);
  await expectLayout(viewport.width);
  await intro.getByRole('link', { name: 'Explore Coffee Club' }).click();
  const how = intro.getByRole('heading', { level: 2, name: 'How Coffee Club Works' });
  await expect(how).toBeFocused();
  await expectClearOfHeader(page, how);
  await expect(main.getByRole('region')).toHaveCount(3);
  await expect(details.getByRole('navigation', { name: 'Explore Lumi Lane after Coffee Club' })).toBeVisible();
});
