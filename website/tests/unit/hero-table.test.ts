// V2 hero: tabletop geometry and the hero-slide → menu mapping.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HERO } from '../../src/data/content.ts';
import { MENU } from '../../src/data/menu.ts';
import {
  PLATE,
  RING,
  SLOT_COUNT,
  STEP,
  computeLayout,
  dishOfSlot,
  modeFor,
  nearestSlotForDish,
  rotationForSlot,
  slotPosition,
} from '../../src/features/home/heroTable.ts';

const N = HERO.slides.length;

test('every hero slide points at a real, priced menu item and a real menu tab', () => {
  const items = new Map(
    MENU.flatMap((c) => c.columns.flatMap((col) => (col.kind === 'list' ? col.items : []))).map((i) => [i.id, i]),
  );
  const tabs = new Set(MENU.map((c) => c.id));
  for (const s of HERO.slides) {
    const item = items.get(s.menuId);
    assert.ok(item, `${s.menuId} exists in menu.ts`);
    assert.equal(item.kind, 'std');
    assert.ok(tabs.has(s.categoryHash), `${s.categoryHash} is a menu tab`);
    const cat = MENU.find((c) => c.columns.some((col) => col.kind === 'list' && col.items.includes(item)));
    assert.equal(cat?.id, s.categoryHash, `${s.menuId} lives in the ${s.categoryHash} tab`);
  }
  assert.equal(new Set(HERO.slides.map((s) => s.menuId)).size, N, 'no duplicate dishes');
});

test('the menu itself is untouched: 136 entries over 4 categories', () => {
  const count = MENU.flatMap((c) => c.columns.flatMap((col) => (col.kind === 'list' ? col.items : []))).length;
  assert.equal(MENU.length, 4);
  assert.equal(count, 136);
});

test('slots: every dish appears exactly twice, on opposite sides of the table', () => {
  assert.equal(SLOT_COUNT % N, 0);
  for (let d = 0; d < N; d++) {
    const slots = [...Array(SLOT_COUNT).keys()].filter((j) => dishOfSlot(j, N) === d);
    assert.equal(slots.length, SLOT_COUNT / N);
    assert.equal((slots[1]! - slots[0]!) * STEP, 180);
  }
  assert.equal(dishOfSlot(-1, N), N - 1);
});

test('plates stay on the table and do not collide', () => {
  const p0 = slotPosition(0);
  assert.deepEqual(p0, { left: 50, top: 50 - 50 * RING });
  const chord = 2 * RING * Math.sin(((STEP / 2) * Math.PI) / 180);
  assert.ok(chord >= PLATE, `neighbour spacing ${chord.toFixed(3)} ≥ plate ${PLATE}`);
  assert.ok(RING + PLATE / 2 <= 1.05, 'plates overhang the rim by at most 5% of the radius');
});

test('rotation: next turns anticlockwise by one step; nearest slot never turns more than half a cycle', () => {
  assert.equal(rotationForSlot(1, -33) - rotationForSlot(0, -33), -STEP);
  for (let cur = -7; cur <= 7; cur++)
    for (let d = 0; d < N; d++) {
      const j = nearestSlotForDish(d, cur, N);
      assert.equal(dishOfSlot(j, N), d);
      assert.ok(Math.abs(j - cur) <= N / 2);
    }
  assert.equal(nearestSlotForDish(1, 0, N), 1);
  assert.equal(nearestSlotForDish(4, 0, N), -1); // back one, not forward four
});

test('layout: split on wide screens, stacked on portrait and phones; featured plate on screen', () => {
  assert.equal(modeFor(1440, 900), 'split');
  assert.equal(modeFor(1024, 768), 'split');
  assert.equal(modeFor(768, 1024), 'stacked');
  assert.equal(modeFor(390, 844), 'stacked');
  for (const [w, h, textRight, textBottom] of [
    [1440, 900, 560, 700],
    [1920, 1080, 640, 800],
    [1024, 768, 430, 620],
    [768, 1024, 650, 500],
    [390, 844, 370, 430],
    [360, 640, 350, 420],
  ] as const) {
    const L = computeLayout({ width: w, height: h, textRight, textBottom });
    const a = (L.featuredAngle * Math.PI) / 180;
    const fx = L.cx + RING * L.r * Math.sin(a);
    const fy = L.cy - RING * L.r * Math.cos(a);
    const half = (PLATE * L.r) / 2;
    assert.ok(fx - half > -1 && fx + half < w + 1, `${w}x${h}: featured plate inside horizontally`);
    assert.ok(fy - half > 0 && fy + half < h + 60, `${w}x${h}: featured plate inside vertically`);
    if (L.mode === 'split') assert.ok(fx - half > textRight, `${w}x${h}: plate clear of the text column`);
    else assert.ok(fy - half >= textBottom, `${w}x${h}: plate below the text`);
    assert.ok(L.intro.scale > 0 && L.intro.scale < 1);
  }
});
