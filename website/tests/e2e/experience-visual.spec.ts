import { expect, test, type Page } from '@playwright/test';

const sizes = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

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
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const destination = (name: string) => `qa/phase1-phase2/${name}-${viewport.width}.png`;

    for (const route of ['login', 'signup']) {
      await page.goto(`/${route}/`);
      const content = page.getByRole('main');
      await expect(content.getByRole('heading', { level: 1 })).toBeVisible();
      await noOverflow(page);
      if (viewport.width <= 720) {
        const form = await content.locator('form').boundingBox();
        const editorial = await content.locator('figure').boundingBox();
        expect(form!.y + form!.height).toBeLessThan(editorial!.y);
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
    if (viewport.width >= 1024) {
      const logo = (await header.locator('.site-wordmark').boundingBox())!;
      const nav = (await header.locator('.site-nav-list').boundingBox())!;
      const actions = (await header.locator('.site-header-actions').boundingBox())!;
      expect(Math.abs(nav.x + nav.width / 2 - viewport.width / 2)).toBeLessThan(2);
      expect(logo.x + logo.width).toBeLessThan(nav.x);
      expect(nav.x + nav.width).toBeLessThan(actions.x);
    }
    await header.screenshot({ path: destination('header'), scale: 'css' });
    if (viewport.width === 390 || viewport.width === 768) {
      await header.getByRole('button', { name: 'Open navigation' }).click();
      await expect(header.getByRole('link', { name: 'Sign Up' })).toBeVisible();
      await page.screenshot({ path: destination('header-open'), scale: 'css' });
      await header.getByRole('button', { name: 'Close navigation' }).click();
    }

    await header.getByRole('button', { name: 'Shopping bag' }).click();
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
      await main.locator('.lane-menu-bag').click();
      await expect(bag.getByTestId('cart-subtotal')).toHaveText('$31.70 AUD');
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
    await noOverflow(page);
    await footer.screenshot({ path: `qa/four-phase/footer-${viewport.width}.png`, scale: 'css' });
    expect(errors).toEqual([]);
  });
}

test('desktop account hover moves the kinetic text and magnetic pill', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'The desktop effects use a fine pointer.');
  await page.goto('/login/');
  const header = page.locator('.site-desktop-account');
  const login = header.getByRole('link', { name: 'Log In' });
  const text = login.locator('.site-login-window > span').first();
  await login.hover();
  await expect.poll(() => text.evaluate((element) => getComputedStyle(element).transform)).not.toBe('none');
  const signup = header.getByRole('link', { name: 'Sign Up' });
  const bounds = (await signup.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.62);
  await expect.poll(() => signup.evaluate((element) => element.style.getPropertyValue('--magnet-x'))).not.toBe('');
  const pill = signup.locator('.site-signup-pill');
  await expect
    .poll(() => pill.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41))
    .toBeGreaterThan(0);
  await expect(signup.locator('svg')).toHaveCount(0);
  await page.mouse.move(8, 150);
  await expect.poll(() => signup.evaluate((element) => element.style.getPropertyValue('--magnet-x'))).toBe('');
});
