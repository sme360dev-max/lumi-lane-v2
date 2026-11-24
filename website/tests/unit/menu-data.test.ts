// Proves every menu entry, price, description, section title and note of the ORIGINAL prototype
// (reference/original-index.html, untouched copy from LumiLane-Recovered.zip) survives in src/data/menu.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MENU } from '../../src/data/menu.ts';
import type { MenuColumn, MenuItem } from '../../src/types/menu.ts';

const html = readFileSync(new URL('../../reference/original-index.html', import.meta.url), 'utf8');
const text = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

function panel(id: string): string {
  const start = html.indexOf(`id="panel-${id}"`);
  const next = html.indexOf('role="tabpanel"', start + 10);
  const end = next > 0 ? next : html.indexOf('Stay a little longer', start);
  assert.ok(start > 0, `panel ${id} exists in original`);
  return html.slice(start, end);
}

const itemText = (it: MenuItem) =>
  it.kind === 'std'
    ? [it.name, it.price, it.description ?? ''].join(' ').trim()
    : it.kind === 'acai'
      ? `${it.name} ${it.description}`
      : `${it.name} ${it.region} ${it.glass} ${it.bottle}`;

const columnHeadings = (c: MenuColumn): string[] =>
  c.kind === 'list'
    ? [c.title, ...(c.note ? [c.note] : [])]
    : c.kind === 'notice'
      ? [c.title, c.text]
      : [...c.groups.flatMap((g) => [g.title, ...g.rows.map((r) => `${r.label} ${r.price}`)]), c.note];

test('four categories in the original order', () => {
  assert.deepEqual(
    MENU.map((c) => c.id),
    ['brunch', 'acai', 'coffee', 'bar'],
  );
  assert.deepEqual(
    MENU.map((c) => c.label),
    ['Brunch', 'Açai', 'Coffee & Drinks', 'Bar'],
  );
});

test('136 menu entries with unique ids', () => {
  const items = MENU.flatMap((c) => c.columns.flatMap((col) => (col.kind === 'list' ? col.items : [])));
  assert.equal(items.length, 136);
  assert.equal(new Set(items.map((i) => i.id)).size, 136);
});

for (const cat of MENU) {
  test(`${cat.label}: every item matches the original text exactly, in order`, () => {
    const p = panel(cat.id);
    const original = [...p.matchAll(/<li class="[^"]*" data-image="">([\s\S]*?)<\/li>/g)].map((m) => text(m[1]!));
    const ours = cat.columns.flatMap((c) => (c.kind === 'list' ? c.items.map(itemText) : []));
    assert.deepEqual(ours, original);
  });

  test(`${cat.label}: section titles, notes and price tables match the original`, () => {
    const t = text(panel(cat.id));
    for (const c of cat.columns) for (const s of columnHeadings(c)) assert.ok(t.includes(s), `missing "${s}"`);
  });
}

test('cents agree with the printed prices', () => {
  const toCents = (s: string) => Math.round(Number(s.replace('$', '')) * 100);
  for (const c of MENU)
    for (const col of c.columns) {
      if (col.kind === 'pricing')
        col.groups.forEach((g) => g.rows.forEach((r) => assert.equal(r.priceCents, toCents(r.price))));
      if (col.kind !== 'list') continue;
      for (const it of col.items) {
        if (it.kind === 'std') assert.equal(it.priceCents, toCents(it.price), it.id);
        if (it.kind === 'wine') {
          assert.equal(it.glassCents, it.glass === '-' ? null : toCents(it.glass), it.id);
          assert.equal(it.bottleCents, it.bottle === '-' ? null : toCents(it.bottle), it.id);
        }
      }
    }
});
