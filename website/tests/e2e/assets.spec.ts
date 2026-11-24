import { expect, test } from '@playwright/test';

const IMAGES: Record<string, number[]> = {
  coffee: [480, 800, 1254],
  choco: [480, 800, 1254],
  food: [480, 800, 1254],
  mezze: [480, 800, 1254],
  burger: [480, 800, 1254],
  storefront: [480, 800, 1200],
};

test('all original images are served and none render broken', async ({ page }) => {
  for (const [name, widths] of Object.entries(IMAGES))
    for (const w of widths)
      for (const ext of ['avif', 'webp'])
        expect((await page.request.get(`/assets/img/${name}-${w}.${ext}`)).status()).toBe(200);

  for (const path of ['/', '/visit/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const broken = await page.evaluate(() =>
      [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
    );
    expect(broken).toEqual([]);
  }
});

test('404 page', async ({ page }) => {
  const res = await page.goto('/nope/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This page has wandered off.' })).toBeVisible();
});

test('robots.txt and sitemap.xml are generated', async ({ page }) => {
  expect(await (await page.request.get('/robots.txt')).text()).toContain('sitemap.xml');
  const sitemap = await (await page.request.get('/sitemap.xml')).text();
  for (const p of ['/menu/', '/about/', '/visit/', '/book/']) expect(sitemap).toContain(p);
});
