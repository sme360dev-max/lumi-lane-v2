import { expect, test } from '@playwright/test';
import { ABOUT } from '../../src/data/content';

test('search, filters, price sorting and variant bag totals work together', async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.goto('/menu/');
  await page.getByRole('tab', { name: 'All items' }).click();
  await expect(page.getByRole('tabpanel').locator('[data-item-id]')).toHaveCount(136);
  const search = page.getByRole('searchbox', { name: 'Search menu by name' });
  await search.fill('Chilli eggs');
  await expect(page.getByRole('tabpanel').locator('[data-item-id]')).toHaveCount(1);
  const addEggs = page.getByRole('button', { name: 'Add one Chilli Eggs', exact: true });
  await expect(page.getByRole('button', { name: 'Remove one Chilli Eggs', exact: true })).toBeDisabled();
  await addEggs.click();
  await addEggs.click();
  await expect(page.locator('.site-cart-link')).toHaveAccessibleName('Shopping bag, 2 items');

  const filters = page.getByRole('button', { name: 'Sort & Filter' });
  await filters.click();
  const dialog = page.getByRole('dialog', { name: 'Sort & Filter' });
  await expect(dialog).toBeVisible();
  if (info.project.name === 'mobile-390') {
    await expect
      .poll(async () => {
        const box = (await dialog.boundingBox())!;
        return Math.abs(box.y + box.height - page.viewportSize()!.height);
      })
      .toBeLessThan(2);
    await page.screenshot({ path: 'qa/premium/menu-filter-390.png', scale: 'css' });
  }
  const sort = dialog.getByLabel('Sort by');
  for (const value of ['bestsellers', 'rating', 'newest']) {
    await expect(sort.locator(`option[value="${value}"]`)).toBeDisabled();
  }
  await sort.selectOption('low');
  await dialog.getByLabel('Maximum price').fill('10');
  await dialog.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByText('No dishes match.')).toBeVisible();
  await expect(page.locator('.site-cart-link')).toHaveAccessibleName('Shopping bag, 2 items');
  await search.fill('');
  await page.getByRole('tab', { name: 'Brunch' }).click();
  const visiblePrices = await page.getByRole('tabpanel').locator('[data-item-id] [data-price]').allTextContents();
  const prices = visiblePrices.map((price) => Number(price.replace('$', '')));
  expect(prices.length).toBeGreaterThan(2);
  expect(prices.every((price, index) => price <= 10 && (index === 0 || price >= prices[index - 1]!))).toBe(true);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();

  await page.getByRole('tab', { name: 'Açai' }).click();
  const lumi = page.locator('[data-item-id="acai-lumi"]');
  await expect(lumi.getByText('Choose an option to add')).toBeVisible();
  await lumi.getByRole('combobox').selectOption('acai-lumi:size-0-0');
  await lumi.getByRole('button', { name: 'Add one Lumi, Takeaway · Small' }).click();
  await lumi.getByRole('combobox').selectOption('acai-lumi:size-1-0');
  await lumi.getByRole('button', { name: 'Add one Lumi, Dine In · Bowl' }).click();
  await page.locator('.site-cart-link').click();
  await expect(page.getByTestId('cart-subtotal')).toHaveText('$81.10 AUD');
  await page.reload();
  await page.locator('.site-cart-link').click();
  await expect(page.getByTestId('cart-subtotal')).toHaveText('$81.10 AUD');
  await page.getByRole('button', { name: 'Remove one Chilli Eggs' }).click();
  await expect(page.getByTestId('cart-subtotal')).toHaveText('$59.20 AUD');
  const remove = page.getByRole('button', { name: /^Remove .+ from bag$/ });
  for (let remaining = await remove.count(); remaining > 0; remaining--) await remove.first().click();
  await expect(page.getByRole('dialog').getByText('Your bag is empty.', { exact: false })).toBeVisible();
});

test('visit directions, source hours, phone status and socials are available', async ({ page }) => {
  await page.goto('/visit/');
  const main = page.getByRole('main');
  const directions = main.getByRole('link', { name: 'Get directions', exact: true });
  const url = new URL((await directions.getAttribute('href'))!);
  expect(url.hostname).toBe('www.google.com');
  expect(url.searchParams.get('destination')).toBe('Shop 9, 163/169 Fosters Rd, Lightsview SA 5085, Australia');
  await expect(main.getByText('7:00am to 4:00pm')).toBeVisible();
  await expect(main.getByText('8:00am to 4:00pm')).toBeVisible();
  await expect(main.getByRole('link', { name: '0405 555 442' })).toHaveAttribute('href', 'tel:0405555442');
  await expect(main.getByText('Listed phone number.', { exact: false })).toBeVisible();
  for (const service of ['Instagram', 'TikTok', 'Facebook']) {
    await expect(main.getByRole('link', { name: `Lumi Lane on ${service}` })).toHaveAttribute('href', /^https:\/\//);
  }
});

test('about retains the story, chapters and original quote', async ({ page }) => {
  await page.goto('/about/');
  const main = page.getByRole('main');
  for (const paragraph of ABOUT.columns.flat()) await expect(main.getByText(paragraph, { exact: true })).toBeVisible();
  await expect(main.getByText(ABOUT.quote, { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Coffee and drinks' })).toHaveAttribute('href', '/menu/#coffee');
  await expect(main.getByRole('link', { name: 'See the bar menu' })).toHaveAttribute('href', '/menu/#bar');
});

test('open, scroll and capture the four redesigns at all six requested widths', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'one browser pass captures all viewport widths');
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    const height = width === 768 ? 1024 : 900;
    await page.setViewportSize({ width, height });
    for (const path of ['menu', 'visit', 'book', 'about']) {
      const response = await page.goto(`/${path}/`);
      expect(response?.status()).toBe(200);
      await page.evaluate(async () => {
        await document.fonts.ready;
        const images = [...document.images];
        for (const image of images) image.loading = 'eager';
        await Promise.all(images.map((image) => image.decode()));
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `qa/premium/${width}-${path}.png`, scale: 'css' });
      await page.mouse.wheel(0, Math.round(height * 0.73));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: `qa/premium/${width}-${path}-scroll.png`, scale: 'css' });
      }
    }
  }
});
