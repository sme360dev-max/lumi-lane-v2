import { expect, test, type Page } from '@playwright/test';
import { mockBackend } from './support/backend';

const sizes = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

/** The only API calls a signed-out visitor's pages make; mockBackend answers both by default. */
const PUBLIC_API = ['GET /api/menu/', 'GET /api/loyalty/'];
const INK = 'rgb(39, 27, 21)';
const MASTHEAD_HEIGHT = 72;

const noOverflow = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
};

for (const viewport of sizes) {
  test(`experience visual review at ${viewport.width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-1440', 'This test sets the viewport explicitly.');
    test.setTimeout(55_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const seen = await mockBackend(page);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const destination = (name: string) => `qa/phase1-phase2/${name}-${viewport.width}.png`;

    for (const route of ['login', 'signup']) {
      await page.goto(`/${route}/`);
      const content = page.getByRole('main');
      await expect(content.getByRole('heading', { level: 1 })).toBeVisible();
      await noOverflow(page);
      // The login page also carries a password-reset form, folded away until it is asked for.
      const form = content.locator('form.account-form');
      const recovery = content.locator('details.account-recovery');
      if (route === 'login') {
        await expect(recovery.locator('summary')).toHaveText('Forgot password?');
        await expect(recovery).not.toHaveAttribute('open');
        await expect(recovery.locator('form')).toBeHidden();
      } else await expect(recovery).toHaveCount(0);
      if (viewport.width <= 720) {
        const formBox = await form.boundingBox();
        const editorial = await content.locator('figure').boundingBox();
        expect(formBox!.y + formBox!.height).toBeLessThan(editorial!.y);
      }
      await page.evaluate(() => document.fonts.ready);
      await expect
        .poll(() => content.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      await content.screenshot({ path: destination(route), scale: 'css' });
    }

    await page.goto('/menu/');
    const header = page.locator('.site-header');
    await page.evaluate(() => document.fonts.ready);
    expect((await header.boundingBox())!.height).toBe(MASTHEAD_HEIGHT);
    expect(await header.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');
    const logo = (await header.locator('.site-wordmark').boundingBox())!;
    const actions = (await header.locator('.site-header-actions').boundingBox())!;
    const bagTrigger = header.getByRole('button', { name: 'Shopping bag', exact: true });
    // The wordmark sits on the centre line at every width.
    expect(Math.abs(logo.x + logo.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(logo.x + logo.width).toBeLessThan(actions.x);
    if (viewport.width >= 1024) {
      // Links left, wordmark centred, account links and bag right.
      const nav = (await header.locator('.site-nav-list').boundingBox())!;
      expect(nav.x + nav.width).toBeLessThan(logo.x);
      const account = header.getByRole('navigation', { name: 'Account and shopping' });
      await expect(account.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
      await expect(account.getByRole('link', { name: 'Sign up', exact: true })).toBeVisible();
      await expect(header.getByRole('button', { name: 'Open navigation' })).toBeHidden();
    } else {
      // Menu button left, wordmark centred, bag right; the links wait in the sheet.
      const toggle = (await header.getByRole('button', { name: 'Open navigation' }).boundingBox())!;
      const bagBox = (await bagTrigger.boundingBox())!;
      expect(toggle.x + toggle.width).toBeLessThan(logo.x);
      expect(logo.x + logo.width).toBeLessThan(bagBox.x);
      await expect(header.locator('.site-desktop-account')).toBeHidden();
      await expect(header.getByRole('link', { name: 'Sign up', exact: true })).toBeHidden();
    }
    await header.screenshot({ path: destination('header'), scale: 'css' });
    if (viewport.width === 390 || viewport.width === 768) {
      const primary = header.getByRole('navigation', { name: 'Primary' });
      await primary.getByRole('button', { name: 'Open navigation' }).click();
      for (const name of ['About', 'Visit us', 'Book a table', 'Loyalty', 'Log in', 'Sign up'])
        await expect(primary.getByRole('link', { name, exact: true })).toBeVisible();
      await expect(primary.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
      // The sheet runs from the masthead to the bottom of the screen.
      const sheet = (await header.locator('.site-nav-panel').boundingBox())!;
      expect(Math.abs(sheet.x)).toBeLessThan(1);
      expect(Math.abs(sheet.y - MASTHEAD_HEIGHT)).toBeLessThan(1);
      expect(Math.abs(sheet.width - viewport.width)).toBeLessThan(1);
      expect(Math.abs(sheet.y + sheet.height - viewport.height)).toBeLessThan(1);
      await page.screenshot({ path: destination('header-open'), scale: 'css' });
      await primary.getByRole('button', { name: 'Close navigation' }).click();
      await expect(header.locator('.site-nav-panel')).toBeHidden();
      await expect(primary.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    }

    await bagTrigger.click();
    const bag = page.getByRole('dialog', { name: 'Your bag' });
    await expect(bag).toBeVisible();
    expect(await bag.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
    const bagBounds = (await bag.boundingBox())!;
    expect(Math.abs(bagBounds.x)).toBeLessThan(1);
    expect(bagBounds.width).toBeLessThan(viewport.width);
    await page.screenshot({ path: destination('bag-empty'), scale: 'css' });
    await bag.getByRole('button', { name: 'Close shopping bag' }).click();

    if ([390, 768, 1440].includes(viewport.width)) {
      const main = page.getByRole('main');
      const search = main.getByRole('searchbox', { name: 'Search menu by name' });
      await search.fill('Chilli eggs');
      await main.getByRole('button', { name: 'Add one Chilli Eggs' }).click();
      await main.getByRole('tab', { name: 'Coffee' }).click();
      await search.fill('Cafe Latte');
      const add = main.getByRole('button', { name: 'Add one Cafe Latte' });
      await add.click();
      await add.click();
      await expect(header.getByRole('button', { name: 'Shopping bag, 3 items', exact: true })).toBeVisible();
      await main.locator('.lane-menu-bag').click();
      await expect(bag.getByTestId('cart-subtotal')).toHaveText('$31.70 AUD');
      // Ordering needs an account, so a visitor is pointed to the login page.
      await expect(bag.getByRole('link', { name: 'Log in to order' })).toHaveAttribute('href', '/login/');
      await expect
        .poll(() =>
          bag
            .locator('img')
            .first()
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBeGreaterThan(0);
      await page.screenshot({ path: destination('bag-populated'), scale: 'css' });
      await bag.getByRole('button', { name: 'Close shopping bag' }).click();
    }

    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'Back to the Lumi Lane homepage' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Back to top', exact: true })).toHaveAttribute('href', '#main');
    await noOverflow(page);
    await footer.screenshot({ path: `qa/four-phase/footer-${viewport.width}.png`, scale: 'css' });
    // Nothing on these pages needs an account, so nothing but the public endpoints is asked for.
    expect(seen.map(({ method, path }) => `${method} ${path}`).filter((call) => !PUBLIC_API.includes(call))).toEqual(
      [],
    );
    expect(errors).toEqual([]);
  });
}

test('desktop account hover underlines the log in label and fills the sign up outline', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'The desktop effects use a fine pointer.');
  await mockBackend(page);
  // Not /login/ or /signup/: there the link for the current page is already marked.
  await page.goto('/about/');
  const account = page.locator('.site-desktop-account');
  const login = account.getByRole('link', { name: 'Log in', exact: true });
  const signup = account.getByRole('link', { name: 'Sign up', exact: true });
  const loginLabel = login.locator('span');
  const outline = signup.locator('span');
  // How much of the rule under "Log in" is drawn: 0 at rest, 1 once it has grown from the left.
  const underline = () =>
    loginLabel.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element, '::after').transform).a);
  const fill = () => outline.evaluate((element) => getComputedStyle(element).backgroundColor);

  // The kinetic text window, the pill and its pointer magnet are gone.
  await expect(page.locator('.site-login-window, .site-signup-pill')).toHaveCount(0);
  await expect(signup).toHaveClass(/site-signup-link/);
  await expect(signup.locator('svg')).toHaveCount(0);

  expect(await underline()).toBe(0);
  expect(await loginLabel.evaluate((element) => getComputedStyle(element, '::after').transformOrigin)).toMatch(/^0px /);
  await login.hover();
  await expect.poll(underline).toBe(1);

  // Sign up is a 1px outlined rectangle that fills with ink under the pointer.
  const rest = await outline.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      border: `${style.borderTopWidth} ${style.borderTopStyle}`,
      radius: parseFloat(style.borderTopLeftRadius),
      background: style.backgroundColor,
    };
  });
  expect(rest.border).toBe('1px solid');
  expect(rest.radius).toBeLessThanOrEqual(2);
  expect(rest.background).toBe('rgba(0, 0, 0, 0)');
  const bounds = (await signup.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.62);
  await expect.poll(fill).toBe(INK);
  await expect.poll(() => outline.evaluate((element) => getComputedStyle(element).borderTopColor)).toBe(INK);
  await expect.poll(underline).toBe(0);
  // The outline stays where it is: nothing follows the pointer.
  expect(await signup.evaluate((element) => element.style.getPropertyValue('--magnet-x'))).toBe('');
  expect(await outline.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  expect((await signup.boundingBox())!).toEqual(bounds);
  await page.mouse.move(8, 150);
  await expect.poll(fill).toBe('rgba(0, 0, 0, 0)');
});
