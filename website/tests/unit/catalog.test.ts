import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canSort, CART_CHOICES, CATALOG, EMPTY_FILTERS, filterMenu } from '../../src/features/menu/catalog.ts';

test('all original items have an explicit price choice from their source data', () => {
  assert.equal(CATALOG.length, 136);
  assert.equal(
    CART_CHOICES.size,
    CATALOG.reduce((total, item) => total + item.choices.length, 0),
  );
  for (const { item, choices } of CATALOG) {
    assert.ok(choices.length, item.id);
    assert.ok(
      choices.every(({ cents }) => Number.isSafeInteger(cents) && cents > 0),
      item.id,
    );
    if (item.kind === 'std') assert.equal(choices[0]?.cents, item.priceCents);
    if (item.kind === 'wine') {
      assert.deepEqual(
        choices.map(({ cents }) => cents),
        [item.glassCents, item.bottleCents].filter((cents) => cents !== null),
      );
    }
    if (item.kind === 'acai')
      assert.deepEqual(
        choices.map(({ cents }) => cents),
        [1690, 2040, 2040],
      );
  }
});

test('name, tab, verified price and option filters combine with price sorting', () => {
  const bowls = filterMenu('all', 'FROYO', { ...EMPTY_FILTERS, min: '20', max: '21', kind: 'options', sort: 'high' });
  assert.deepEqual(
    bowls.map(({ item, sortPrice }) => [item.name, sortPrice]),
    [['Coco Froyo', 2040]],
  );
  assert.equal(filterMenu('brunch', 'froyo', EMPTY_FILTERS).length, 0);
  const prices = filterMenu('all', '', { ...EMPTY_FILTERS, min: '5', max: '15', sort: 'high' }).map(
    ({ sortPrice }) => sortPrice,
  );
  assert.ok(prices.length > 10);
  assert.ok(prices.every((price, i) => price >= 500 && price <= 1500 && (i === 0 || price <= prices[i - 1]!)));
});

test('merchandising sorts require verified local metadata', () => {
  assert.equal(canSort('low'), true);
  for (const key of ['bestsellers', 'rating', 'newest'] as const) assert.equal(canSort(key), false);
});
