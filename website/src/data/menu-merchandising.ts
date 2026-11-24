/** Optional, venue-verified merchandising data keyed by the original menu item IDs. */
export interface MenuMerchandising {
  bestsellerRank?: number;
  rating?: number;
  introducedOn?: string; // ISO calendar date
}

export const MENU_MERCHANDISING: Readonly<Partial<Record<string, MenuMerchandising>>> = {};
