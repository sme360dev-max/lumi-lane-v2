import { MENU } from '../../data/menu.ts';
import { MENU_MERCHANDISING } from '../../data/menu-merchandising.ts';
import type { CategoryId, MenuCategory, MenuItem } from '../../types/menu.ts';

export interface MenuChoice {
  key: string;
  label: string;
  price: string;
  cents: number;
}

export interface CatalogItem {
  item: MenuItem;
  category: CategoryId;
  section: string;
  choices: MenuChoice[];
}

function createCatalog(categories: MenuCategory[]): CatalogItem[] {
  return categories.flatMap((category) =>
    category.columns.flatMap((column) =>
    column.kind === 'list'
      ? column.items.map((item) => ({
          item,
          category: category.id,
          section: column.title,
          choices: getMenuChoices(item, categories),
        }))
      : [],
    ),
  );
}

let activeCategories: MenuCategory[] = MENU;
let activeCatalog: CatalogItem[] = createCatalog(MENU);
const validItemIds = new Set(activeCatalog.map(({ item }) => item.id));
export const CATALOG: CatalogItem[] = activeCatalog;
export const getCatalog = () => activeCatalog;
export const isMenuItemId = (id: string) => validItemIds.has(id);

export function setMenuCategories(categories: MenuCategory[]) {
  activeCategories = categories;
  activeCatalog = createCatalog(categories);
  validItemIds.clear();
  activeCatalog.forEach(({ item }) => validItemIds.add(item.id));
  CART_CHOICES.clear();
  activeCatalog.forEach(({ item, category, choices }) => choices.forEach((choice) => {
    CART_CHOICES.set(choice.key, { ...choice, name: item.name, itemId: item.id, category });
  }));
}

export function buildCatalog(categories: MenuCategory[]) {
  return createCatalog(categories);
}

export function getMenuChoices(item: MenuItem, categories: MenuCategory[] = activeCategories): MenuChoice[] {
  const choice = (id: string, label: string, price: string, cents: number): MenuChoice => ({
    key: `${item.id}:${id}`,
    label,
    price,
    cents,
  });
  switch (item.kind) {
    case 'std':
      return [choice('standard', '', item.price, item.priceCents)];
    case 'wine':
      return [
        ...(item.glassCents === null ? [] : [choice('glass', 'Glass', item.glass, item.glassCents)]),
        ...(item.bottleCents === null ? [] : [choice('bottle', 'Bottle', item.bottle, item.bottleCents)]),
      ];
    case 'acai':
      return categories.find((category) => category.id === 'acai')?.columns.flatMap((column) =>
        column.kind === 'pricing'
          ? column.groups.flatMap((group, groupIndex) =>
              group.rows.map((row, rowIndex) =>
                choice(`size-${groupIndex}-${rowIndex}`, `${group.title} · ${row.label}`, row.price, row.priceCents),
              ),
            )
          : [],
      ) ?? [];
  }
}

export const CART_CHOICES = new Map<string, MenuChoice & { name: string; itemId: string; category: CategoryId }>(
  activeCatalog.flatMap(({ item, category, choices }) => choices.map((choice) => [choice.key, { ...choice, name: item.name, itemId: item.id, category }] as const)),
);

export const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
export const money = (cents: number) => AUD.format(cents / 100);

export const SORTS = [
  { value: 'original', label: 'Menu order' },
  { value: 'bestsellers', label: 'Best Sellers' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'low', label: 'Price: Low to High' },
  { value: 'high', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
] as const;

export type Sort = (typeof SORTS)[number]['value'];
export interface MenuFilters {
  min: string;
  max: string;
  kind: 'any' | 'standard' | 'options';
  sort: Sort;
}

export const EMPTY_FILTERS: MenuFilters = { min: '', max: '', kind: 'any', sort: 'original' };

function verifiedRank(itemId: string, sort: Sort): number | undefined {
  const info = MENU_MERCHANDISING[itemId];
  if (sort === 'bestsellers' && info?.bestsellerRank && info.bestsellerRank > 0) return -info.bestsellerRank;
  if (sort === 'rating' && info?.rating !== undefined && info.rating >= 0 && info.rating <= 5) return info.rating;
  if (sort === 'newest' && info?.introducedOn && /^\d{4}-\d{2}-\d{2}$/.test(info.introducedOn)) {
    const time = Date.parse(info.introducedOn);
    if (Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === info.introducedOn) return time;
  }
  return undefined;
}

export function canSort(sort: Sort): boolean {
  return (
    sort === 'original' ||
    sort === 'low' ||
    sort === 'high' ||
    activeCatalog.some(({ item }) => verifiedRank(item.id, sort) !== undefined)
  );
}

const normalise = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

export function filterMenu(category: CategoryId | 'all', query: string, filters: MenuFilters) {
  const min = filters.min === '' ? 0 : Math.round(Number(filters.min) * 100);
  const max = filters.max === '' ? Infinity : Math.round(Number(filters.max) * 100);
  const words = normalise(query).trim().split(/\s+/).filter(Boolean);

  const ranked = activeCatalog.flatMap((entry) => {
    if (category !== 'all' && entry.category !== category) return [];
    const name = normalise(entry.item.name);
    if (!words.every((word) => name.includes(word))) return [];
    if (filters.kind === 'standard' && entry.item.kind !== 'std') return [];
    if (filters.kind === 'options' && entry.item.kind === 'std') return [];
    const prices = entry.choices.map(({ cents }) => cents).filter((cents) => cents >= min && cents <= max);
    return prices.length ? [{ ...entry, sortPrice: Math.min(...prices) }] : [];
  });

  if (filters.sort === 'low') return ranked.sort((a, b) => a.sortPrice - b.sortPrice);
  if (filters.sort === 'high') return ranked.sort((a, b) => b.sortPrice - a.sortPrice);
  if (filters.sort !== 'original') {
    return ranked.sort((a, b) => {
      const aRank = verifiedRank(a.item.id, filters.sort);
      const bRank = verifiedRank(b.item.id, filters.sort);
      if (aRank === undefined) return bRank === undefined ? 0 : 1;
      return bRank === undefined ? -1 : bRank - aRank;
    });
  }
  return ranked;
}
