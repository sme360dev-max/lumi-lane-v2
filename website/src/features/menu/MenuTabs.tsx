'use client';

import { ctaClass } from '@/components/ui/Button';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useOpenBag } from '@/features/cart/CartDrawer';
import { countItems, useCart } from '@/features/cart/cart-state';
import { useFavorites } from '@/features/account/favorites';
import type { CategoryId } from '@/types/menu';
import { EMPTY_FILTERS, filterMenu, money, SORTS, type CatalogItem, type MenuFilters as Filters } from './catalog';
import { MenuColumn } from './MenuColumn';
import { MenuFilters } from './MenuFilters';
import { MenuItemRow } from './MenuItems';
import { useMenuCategories } from './menu-data';

type Tab = CategoryId | 'all';

export function MenuTabs() {
  const menuCategories = useMenuCategories();
  const tabs = useMemo(() => [{ id: 'all' as const, label: 'All items' }, ...menuCategories], [menuCategories]);
  const [active, setActive] = useState<Tab>('brunch');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const bag = useCart();
  const favorites = useFavorites();
  const count = countItems(bag);
  const openBag = useOpenBag();
  const items = useMemo(() => filterMenu(active, query, filters), [active, query, filters]);

  useEffect(() => {
    const sync = () => {
      const fragment = window.location.hash.slice(1);
      setActive(tabs.find(({ id }) => id === fragment)?.id ?? 'brunch');
    };
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, [tabs]);

  const select = (id: Tab) => {
    setActive(id);
    const url = id === 'brunch' ? window.location.pathname : `${window.location.pathname}#${id}`;
    if (url !== window.location.pathname + window.location.hash) window.history.pushState(null, '', url);
  };

  const changeTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;
    const tab = tabs[next];
    if (!tab) return;
    event.preventDefault();
    tabRefs.current[tab.id]?.focus();
    select(tab.id);
  };

  const clear = () => {
    setQuery('');
    setFilters(EMPTY_FILTERS);
  };
  const hasFilters =
    query.trim() || filters.min || filters.max || filters.kind !== 'any' || filters.sort !== 'original';
  const selectedCategory = menuCategories.find(({ id }) => id === active);
  const groupBySection = filters.sort === 'original' && active !== 'all';
  const renderItems = (entries: CatalogItem[], showSection?: boolean) => (
    <ul className={showSection ? 'lane-menu-list lane-menu-list--mixed' : 'lane-menu-list'}>
      {entries.map((entry) => (
        <MenuItemRow
          key={entry.item.id}
          entry={entry}
          bag={bag}
          showSection={showSection}
          favorite={favorites.includes(entry.item.id)}
        />
      ))}
    </ul>
  );

  return (
    <>
      <div role="tablist" aria-label="Menu categories" className="lane-menu-tabs">
        {tabs.map(({ id, label }, index) => (
          <button
            key={id}
            ref={(element) => {
              tabRefs.current[id] = element;
            }}
            role="tab"
            id={`tab-${id}`}
            type="button"
            aria-controls={`panel-${id}`}
            aria-selected={id === active}
            tabIndex={id === active ? 0 : -1}
            onClick={() => select(id)}
            onKeyDown={(event) => changeTab(event, index)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="lane-menu-tools">
        <label className="lane-menu-search">
          <svg
            viewBox="0 0 20 20"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="8.5" cy="8.5" r="5" />
            <path d="m12.2 12.2 4 4" />
          </svg>
          <span className="sr-only">Search menu by name</span>
          <input
            type="search"
            placeholder="Search by dish name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <MenuFilters
          filters={filters}
          category={active}
          categories={tabs}
          onApply={(next, category) => {
            setFilters(next);
            if (category !== active) select(category);
          }}
        />
        <button
          type="button"
          className="lane-menu-bag"
          aria-haspopup="dialog"
          aria-controls="shopping-bag"
          onClick={(event) => openBag(event.currentTarget)}
        >
          Shopping bag <span aria-label={`${count} items`}>{count}</span>
        </button>
      </div>
      <div className="lane-menu-results">
        <p role="status">
          {items.length} {items.length === 1 ? 'item' : 'items'} · {tabs.find(({ id }) => id === active)?.label}
        </p>
        {hasFilters && (
          <div className="lane-menu-chips" aria-label="Active filters">
            {query.trim() && (
              <button type="button" onClick={() => setQuery('')}>
                “{query.trim()}” <span aria-hidden="true">×</span>
                <span className="sr-only"> Clear search</span>
              </button>
            )}
            {(filters.min || filters.max) && (
              <button type="button" onClick={() => setFilters({ ...filters, min: '', max: '' })}>
                {filters.min && filters.max
                  ? `${money(Number(filters.min) * 100)}–${money(Number(filters.max) * 100)}`
                  : filters.min
                    ? `From ${money(Number(filters.min) * 100)}`
                    : `Up to ${money(Number(filters.max) * 100)}`}
                <span aria-hidden="true">×</span>
                <span className="sr-only"> Clear price range</span>
              </button>
            )}
            {filters.kind !== 'any' && (
              <button type="button" onClick={() => setFilters({ ...filters, kind: 'any' })}>
                {filters.kind === 'standard' ? 'Single price' : 'Size or pour'} <span aria-hidden="true">×</span>
                <span className="sr-only"> Clear price type</span>
              </button>
            )}
            {filters.sort !== 'original' && (
              <button type="button" onClick={() => setFilters({ ...filters, sort: 'original' })}>
                {SORTS.find(({ value }) => value === filters.sort)?.label} <span aria-hidden="true">×</span>
                <span className="sr-only"> Clear sort</span>
              </button>
            )}
            <button type="button" className="lane-clear" onClick={clear}>
              Clear all
            </button>
          </div>
        )}
      </div>

      {tabs.map(({ id, label }) => (
        <div
          key={id}
          role="tabpanel"
          id={`panel-${id}`}
          aria-labelledby={`tab-${id}`}
          hidden={id !== active}
          tabIndex={0}
          className="lane-menu-panel"
        >
          {id === active && (
            <>
              <h2 className="sr-only">{label}</h2>
              {items.length === 0 ? (
                <div className="lane-empty">
                  <h3>No dishes match.</h3>
                  <p>Try another name, category or price range.</p>
                  <button type="button" className={ctaClass({ variant: 'editorial', className: 'lane-text-link' })} onClick={clear}>
                    Clear all filters
                  </button>
                </div>
              ) : groupBySection ? (
                <div className="lane-editorial-columns">
                  {selectedCategory?.columns.map((column, index) => {
                    if (column.kind !== 'list') return <MenuColumn key={index} column={column} />;
                    const entries = items.filter(({ section }) => section === column.title);
                    if (!entries.length) return null;
                    return (
                      <section className="lane-menu-group" key={column.title}>
                        <div className="lane-menu-group-header">
                          <h3>{column.title}</h3>
                          {column.note && <p>{column.note}</p>}
                        </div>
                        {renderItems(entries)}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <>
                  <h3 className="lane-mixed-heading">
                    {filters.sort === 'original' ? 'Menu items' : 'Sorted results'}
                  </h3>
                  {renderItems(items, true)}
                  {selectedCategory?.columns.map(
                    (column, index) => column.kind !== 'list' && <MenuColumn key={index} column={column} />,
                  )}
                </>
              )}
            </>
          )}
        </div>
      ))}
    </>
  );
}
