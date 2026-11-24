// V2 rotating-tabletop hero: navigation, state sync, animation lifecycle, responsive fit, a11y basics.
import { expect, test, type Page } from '@playwright/test';
import { HERO } from '../../src/data/content';
import { MENU } from '../../src/data/menu';

const SLIDES = HERO.slides;
const N = SLIDES.length;
const ITEMS = new Map(
  MENU.flatMap((c) => c.columns.flatMap((col) => (col.kind === 'list' ? col.items : []))).map((i) => [i.id, i]),
);
const nameOf = (i: number) => ITEMS.get(SLIDES[i]!.menuId)!.name;

const hex = (c: string) => {
  const m = c.match(/\d+/g)!.map(Number);
  return (
    '#' +
    m
      .slice(0, 3)
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
};

/** Waits for the hero's own lifecycle flag: the intro or turn timeline has completed. */
async function settled(page: Page) {
  await page.waitForTimeout(60); // let a just-issued click start its timeline
  await expect(page.locator('.hero')).toHaveAttribute('data-state', 'idle', { timeout: 10_000 });
}

async function state(page: Page) {
  return page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('.hero')!;
    const visiblePanels = [...document.querySelectorAll<HTMLElement>('[data-hero-panel]')]
      .filter((p) =>
        [...p.querySelectorAll<HTMLElement>('.hero-rise')].every((r) => getComputedStyle(r).opacity === '1'),
      )
      .map((p) => Number(p.dataset.heroPanel));
    const m = new DOMMatrix(getComputedStyle(document.querySelector('.hero-table')!).transform);
    return {
      active: Number(hero.dataset.active),
      bg: getComputedStyle(hero).backgroundColor,
      visiblePanels,
      rotation: (Math.atan2(m.b, m.a) * 180) / Math.PI,
      current: document.querySelector('.hero-dash[aria-current]')?.getAttribute('aria-label') ?? '',
    };
  });
}

const featuredAngle = (page: Page) =>
  page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.hero-table')!).getPropertyValue('--featured')),
  );

/** Screen angle of the featured seat for the active dish must equal the table's featured angle. */
async function expectFeatured(page: Page, dish: number) {
  const s = await state(page);
  expect(s.active).toBe(dish);
  expect(s.visiblePanels).toEqual([dish]);
  expect(hex(s.bg)).toBe(SLIDES[dish]!.bg);
  expect(s.current).toContain(nameOf(dish));
  // The featured plate for this dish is the one nearest the featured seat.
  const nearest = await page.evaluate(() => {
    const table = document.querySelector<HTMLElement>('.hero-table')!.getBoundingClientRect();
    const plates = [...document.querySelectorAll<HTMLElement>('.hero-plate')];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Featured plate = the largest plate area that is fully centred inside the viewport.
    const inView = plates
      .map((p) => {
        const r = p.getBoundingClientRect();
        return { dish: Number(p.dataset.dish), cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      })
      .filter((p) => p.cx > 0 && p.cx < vw && p.cy > 0 && p.cy < vh);
    const centre = { x: table.left + table.width / 2, y: table.top + table.height / 2 };
    const f = parseFloat(getComputedStyle(document.querySelector('.hero-table')!).getPropertyValue('--featured'));
    const angleOf = (p: { cx: number; cy: number }) => (Math.atan2(p.cx - centre.x, centre.y - p.cy) * 180) / Math.PI;
    return inView.sort((a, b) => Math.abs(angleOf(a) - f) - Math.abs(angleOf(b) - f))[0]?.dish;
  });
  expect(nearest).toBe(dish);
}

test.describe('V2 hero carousel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero')).not.toHaveClass(/hero-pending/, { timeout: 5000 });
    await settled(page);
  });

  test('intro settles on the first dish, synced everywhere', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/Chilli eggs/);
    await expectFeatured(page, 0);
    expect(await featuredAngle(page)).toBeLessThanOrEqual(0);
  });

  test('next / prev buttons, dashes and keyboard move the table and copy together', async ({ page }) => {
    const hero = page.locator('.hero');
    await page.getByRole('button', { name: 'Next dish' }).click();
    await settled(page);
    await expectFeatured(page, 1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(new RegExp(SLIDES[1]!.title.join(' ')));

    await page.getByRole('button', { name: 'Previous dish' }).click();
    await settled(page);
    await expectFeatured(page, 0);

    // Previous from the first dish wraps to the last one (turning the short way).
    await page.getByRole('button', { name: 'Previous dish' }).click();
    await settled(page);
    await expectFeatured(page, N - 1);

    await page.getByRole('button', { name: new RegExp(`^Dish 3 of ${N}`) }).click();
    await settled(page);
    await expectFeatured(page, 2);

    await page.getByRole('button', { name: 'Next dish' }).focus();
    await page.keyboard.press('ArrowRight');
    await settled(page);
    await expectFeatured(page, 3);
    await page.keyboard.press('ArrowLeft');
    await settled(page);
    await expectFeatured(page, 2);
    await expect(hero).toHaveAttribute('data-active', '2');
  });

  test('rapid repeated input never breaks the timeline', async ({ page }) => {
    const next = page.getByRole('button', { name: 'Next dish' });
    for (let i = 0; i < 12; i++) await next.click({ delay: 0, force: true });
    await settled(page);
    await expectFeatured(page, 12 % N);
    // Mixed spam: dashes and arrows mid-turn.
    await page.getByRole('button', { name: new RegExp(`^Dish 5 of ${N}`) }).click();
    await page.getByRole('button', { name: 'Previous dish' }).click();
    await page.getByRole('button', { name: new RegExp(`^Dish 2 of ${N}`) }).click();
    await settled(page);
    await expectFeatured(page, 1);
  });

  test('autoplay advances, pauses on demand and the pause control is announced', async ({ page }) => {
    await page.mouse.move(2, 2); // pointer away from the hero (hover pauses autoplay)
    const pause = page.getByRole('button', { name: 'Pause dish rotation' });
    await expect(pause).toBeVisible();
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.hero')!.dataset.active === '1', undefined, {
      timeout: 12_000,
    });
    await settled(page);
    await expectFeatured(page, 1);
    await page.getByRole('button', { name: 'Pause dish rotation' }).click();
    await expect(page.getByRole('button', { name: 'Play dish rotation' })).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(2, 2);
    await page.waitForTimeout(7500);
    expect((await state(page)).active).toBe(1);
  });

  test('swipe turns the table on touch screens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch only');
    const box = (await page.locator('.hero-plate[data-dish="0"]').first().boundingBox())!;
    const y = Math.min(box.y + box.height / 2, 600);
    await page.evaluate(
      async ({ y }) => {
        const el = document.querySelector('.hero')!;
        const fire = (type: string, x: number) =>
          el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', clientX: x, clientY: y }));
        fire('pointerdown', 320);
        fire('pointerup', 120);
      },
      { y },
    );
    await settled(page);
    await expectFeatured(page, 1);
  });

  test('CTAs go to real routes; no ordering, checkout or ingredient UI exists', async ({ page }) => {
    const cta = page.getByRole('link', { name: new RegExp(`View on the menu.*${nameOf(0)}`, 'i') });
    await expect(cta).toHaveAttribute('href', `/menu/#${SLIDES[0]!.categoryHash}`);
    const html = (await page.locator('main').innerHTML()).toLowerCase();
    for (const banned of ['ingredient', 'checkout', 'add to cart', 'add to order', 'order now'])
      expect(html).not.toContain(banned);
    await cta.click();
    await expect(page).toHaveURL(new RegExp(`/menu/#${SLIDES[0]!.categoryHash}$`));
    await expect(page.getByRole('tab', { name: 'Brunch' })).toHaveAttribute('aria-selected', 'true');
  });

  test('each dish shows its real price and metadata without a decorative dash', async ({ page }) => {
    const pad = (number: number) => String(number).padStart(2, '0');
    for (let i = 0; i < N; i++) {
      await page.getByRole('button', { name: new RegExp(`^Dish ${i + 1} of ${N}`) }).click();
      await settled(page);
      const slide = SLIDES[i]!;
      const meta = page.locator(`[data-hero-panel="${i}"][aria-hidden="false"] .hero-meta`);
      await expect(meta).toBeVisible();
      await expect(meta).toHaveText(`${pad(i + 1)} / ${pad(N)} ${slide.section}`);
      await expect(meta.locator(':scope > *')).toHaveCount(2);
      expect(
        await meta.evaluate((element) =>
          [element.parentElement!, element, ...element.querySelectorAll('*')].every((part) =>
            ['::before', '::after'].every((pseudo) => getComputedStyle(part, pseudo).content === 'none'),
          ),
        ),
      ).toBe(true);
      const item = ITEMS.get(slide.menuId)!;
      if (item.kind !== 'std') throw new Error('hero items are standard items');
      const price = item.price.startsWith('$') ? item.price : `$${item.price}`;
      await expect(page.locator(`[data-hero-panel-body="${i}"] [data-price]`)).toHaveText(price);
    }
  });

  test('accessibility basics: names, hidden layers are inert, one h1, alt text', async ({ page }) => {
    expect(await page.locator('h1').count()).toBe(1);
    // Inactive copy layers are aria-hidden + inert, so their links cannot be tabbed to.
    const focusableHidden = await page.evaluate(
      () =>
        [...document.querySelectorAll('[data-hero-panel-body][inert] a, [data-hero-panel-body][inert] button')].length,
    );
    expect(focusableHidden).toBeGreaterThan(0);
    const unnamedButtons = await page.evaluate(
      () =>
        [...document.querySelectorAll('.hero button')].filter(
          (b) => !b.getAttribute('aria-label') && !b.textContent?.trim(),
        ).length,
    );
    expect(unnamedButtons).toBe(0);
    const imgsWithoutAlt = await page.evaluate(
      () => [...document.querySelectorAll('.hero img')].filter((i) => !i.hasAttribute('alt')).length,
    );
    expect(imgsWithoutAlt).toBe(0);
    // Tab reaches the controls.
    await page.getByRole('button', { name: 'Next dish' }).focus();
    await expect(page.getByRole('button', { name: 'Next dish' })).toBeFocused();
  });

  test('responsive fit: featured plate fully on screen, copy not covered, no overflow', async ({ page }) => {
    const vw = page.viewportSize()!.width;
    const vh = page.viewportSize()!.height;
    const { plate, copy } = await page.evaluate(() => {
      const f = parseFloat(getComputedStyle(document.querySelector('.hero-table')!).getPropertyValue('--featured'));
      const table = document.querySelector('.hero-table')!.getBoundingClientRect();
      const c = { x: table.left + table.width / 2, y: table.top + table.height / 2 };
      const best = [...document.querySelectorAll<HTMLElement>('.hero-plate')]
        .map((p) => p.getBoundingClientRect())
        .map((r) => ({ r, a: (Math.atan2(r.left + r.width / 2 - c.x, c.y - (r.top + r.height / 2)) * 180) / Math.PI }))
        .sort((a, b) => Math.abs(a.a - f) - Math.abs(b.a - f))[0]!.r;
      const t = document.querySelector('.hero-copy-inner')!.getBoundingClientRect();
      return { plate: best.toJSON(), copy: t.toJSON() };
    });
    // Rotated square boxes are larger than the round plate, so allow 12% slack for the corners.
    const slack = plate.width * 0.12;
    expect(plate.left).toBeGreaterThan(-slack);
    expect(plate.right).toBeLessThan(vw + slack);
    const stacked = await page.evaluate(() => document.querySelector<HTMLElement>('.hero')!.dataset.mode === 'stacked');
    if (stacked) expect(plate.top).toBeGreaterThan(copy.bottom - 1);
    else expect(plate.left).toBeGreaterThan(copy.right);
    expect(plate.bottom).toBeLessThan(vh + slack);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test('reduced motion: no intro, no autoplay, instant but synced swaps', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.hero')).not.toHaveClass(/hero-pending/);
  await expect(page.getByRole('button', { name: 'Play dish rotation' })).toBeVisible();
  await page.getByRole('button', { name: 'Next dish' }).click();
  await page.waitForTimeout(50);
  await expectFeatured(page, 1);
});

test('lifecycle: leaving and returning to the hero leaves no errors or stuck tweens', async ({ page }) => {
  const errors: string[] = [];
  const badResponses: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).host === 'localhost:4317') {
      badResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Next dish' }).click(); // mid-intro / mid-turn
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const toggle = nav.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
  await nav.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about\/$/);
  await page.goBack();
  await expect(page.locator('.hero')).not.toHaveClass(/hero-pending/, { timeout: 5000 });
  await settled(page);
  const s = await state(page);
  expect(s.visiblePanels).toEqual([s.active]);
  await page.setViewportSize({ width: 900, height: 1100 }); // cross the split/stacked breakpoint
  await page.waitForTimeout(400);
  await settled(page);
  const after = await state(page);
  expect(after.visiblePanels).toEqual([after.active]);
  expect({ errors, badResponses }).toEqual({ errors: [], badResponses: [] });
});
