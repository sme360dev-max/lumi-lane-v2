export type CategoryId = 'brunch' | 'acai' | 'coffee' | 'bar';

interface ItemBase {
  /** Stable, unique id: `<category>-<slug>`. */
  id: string;
  name: string;
  sectionId: string;
}

/** Name + single printed price (+ optional description). */
export interface StandardItem extends ItemBase {
  kind: 'std';
  /** Exactly as printed on the original menu, e.g. "$25.9" or "4.20". */
  price: string;
  priceCents: number;
  description?: string;
}

/** Açai bowl: priced by the shared size/service table of its category. */
export interface AcaiItem extends ItemBase {
  kind: 'acai';
  description: string;
}

/** Wine: glass and/or bottle price. "-" means not offered that way. */
export interface WineItem extends ItemBase {
  kind: 'wine';
  region: string;
  glass: string;
  bottle: string;
  glassCents: number | null;
  bottleCents: number | null;
}

export type MenuItem = StandardItem | AcaiItem | WineItem;

export interface ListColumn {
  kind: 'list';
  title: string;
  note?: string;
  /** Renders the Gls / Btl header. */
  wine?: boolean;
  className?: string;
  items: MenuItem[];
}

export interface NoticeColumn {
  kind: 'notice';
  title: string;
  text: string;
  className?: string;
}

export interface PricingColumn {
  kind: 'pricing';
  groups: { title: string; rows: { label: string; price: string; priceCents: number }[] }[];
  note: string;
  className?: string;
}

export type MenuColumn = ListColumn | NoticeColumn | PricingColumn;

export interface MenuCategory {
  id: CategoryId;
  label: string;
  columns: MenuColumn[];
}
