// Joins the hero slides (content.ts) with the real menu entries (menu.ts).
// Name, price and description always come from the menu, so the hero cannot invent or drift.
import { HERO, type HeroSlide } from '@/data/content';
import { MENU } from '@/data/menu';
import type { StandardItem } from '@/types/menu';

export interface HeroDish extends HeroSlide {
  name: string;
  /** Display price, exactly as printed on the menu ("$" added where the menu column omits it). */
  price: string;
  description: string;
}

const ITEMS = new Map(
  MENU.flatMap((cat) => cat.columns.flatMap((col) => (col.kind === 'list' ? col.items : []))).map((it) => [it.id, it]),
);

export const HERO_DISHES: HeroDish[] = HERO.slides.map((slide) => {
  const item = ITEMS.get(slide.menuId);
  if (!item || item.kind !== 'std') throw new Error(`Hero slide points at unknown menu item: ${slide.menuId}`);
  const std = item as StandardItem;
  const description = std.description ?? ('note' in slide ? slide.note : undefined) ?? '';
  return {
    ...slide,
    name: std.name,
    price: std.price.startsWith('$') ? std.price : `$${std.price}`,
    description,
  };
});
