import { expect, test } from '@playwright/test';

test('capture the header at the five review widths', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'one pass captures every review width');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/loyalty/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const links = page.locator('.site-nav-list');
    const wordmark = (await page.locator('.site-wordmark').boundingBox())!;
    expect(Math.abs(wordmark.x + wordmark.width / 2 - width / 2)).toBeLessThan(1);
    if (width >= 1024) {
      const bounds = (await links.boundingBox())!;
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(wordmark.x);
      expect(bounds.height).toBe(44);
      // The current page carries the one clay rule, exactly under its word.
      const word = (await links.locator('a[aria-current="page"] span').boundingBox())!;
      const rule = (await page.locator('.site-nav-indicator').boundingBox())!;
      expect(Math.abs(rule.x - word.x)).toBeLessThan(1);
      expect(Math.abs(rule.width - word.width)).toBeLessThan(1);
    }
    await page.screenshot({
      path: `qa/screenshots/header/${width}.png`,
      clip: { x: 0, y: 0, width, height: 122 },
      scale: 'css',
    });
    const menu = page.getByRole('button', { name: 'Open navigation' });
    if (await menu.isVisible()) {
      await menu.click();
      await page.screenshot({
        path: `qa/screenshots/header/${width}-open.png`,
        clip: { x: 0, y: 0, width, height: 405 },
        scale: 'css',
      });
    }
  }
});

// QA evidence: screenshots of every route at 390 / 768 / 1440 (one per Playwright project).
const PAGES = ['/', '/menu/', '/about/', '/visit/', '/book/'];

for (const path of PAGES) {
  test(`screenshot ${path}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // hold the hero on its first dish
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      // Full-page screenshots include images that have yet to reach the native lazy-load threshold.
      const images = [...document.images].filter((image) => image.loading === 'lazy');
      await Promise.allSettled(
        images.map((image) => {
          image.loading = 'eager';
          return image.decode();
        }),
      );
    });
    const name = path === '/' ? 'home' : path.replace(/\//g, '');
    await page.screenshot({ path: `qa/screenshots/${info.project.name}/${name}.png`, fullPage: true, scale: 'css' });
  });
}

// V2: every hero carousel state (reduced motion makes each swap instant and deterministic).
test('screenshot hero carousel states', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const dashes = page.locator('.hero-dash');
  const n = await dashes.count();
  for (let i = 0; i < n; i++) {
    await dashes.nth(i).click();
    await page.mouse.move(1, 1);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `qa/screenshots/${info.project.name}/home-dish-${i + 1}.png`, scale: 'css' });
  }
});

test('screenshot the tabletop intro, turn and settled pose', async ({ page }, info) => {
  const hero = page.locator('.hero');
  const capture = (name: string) =>
    page.screenshot({ path: `qa/screenshots/${info.project.name}/motion-${name}.png`, scale: 'css' });

  await page.goto('/');
  await hero.waitFor();
  await page.waitForFunction(() => document.querySelector('.hero')?.getAttribute('data-state') === 'intro');
  await page.waitForTimeout(510);
  await capture('intro');
  await page.waitForTimeout(600);
  await capture('glide');
  await page.waitForFunction(() => document.querySelector('.hero')?.getAttribute('data-state') === 'idle');
  await capture('settled');
  await page.getByRole('button', { name: 'Next dish' }).click();
  await page.waitForTimeout(490);
  await capture('turn');
});
