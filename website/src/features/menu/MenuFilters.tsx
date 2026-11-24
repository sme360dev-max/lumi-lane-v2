'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ctaClass } from '@/components/ui/Button';
import type { CategoryId } from '@/types/menu';
import { canSort, EMPTY_FILTERS, SORTS, type MenuFilters as Filters } from './catalog';

const PRICE_TYPES = [
  { value: 'any', label: 'All items' },
  { value: 'standard', label: 'Single price' },
  { value: 'options', label: 'Size or pour' },
] as const;

type Category = CategoryId | 'all';

export function MenuFilters({
  filters,
  category,
  categories,
  onApply,
}: {
  filters: Filters;
  category: Category;
  categories: { id: Category; label: string }[];
  onApply: (filters: Filters, category: Category) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(filters);
  const [draftCategory, setDraftCategory] = useState(category);
  const [error, setError] = useState('');

  const close = () => dialog.current?.close();
  const open = () => {
    setDraft(filters);
    setDraftCategory(category);
    setError('');
    dialog.current?.showModal();
    const anchor = trigger.current?.getBoundingClientRect();
    if (anchor && dialog.current) {
      dialog.current.style.setProperty('--filter-right', `${Math.max(16, window.innerWidth - anchor.right)}px`);
      const top = Math.max(16, Math.min(anchor.bottom + 10, window.innerHeight - dialog.current.offsetHeight - 16));
      dialog.current.style.setProperty('--filter-top', `${top}px`);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.min !== '' && draft.max !== '' && Number(draft.min) > Number(draft.max)) {
      setError('Enter a maximum price at or above the minimum.');
      event.currentTarget.querySelector<HTMLElement>('#menu-filter-max')?.focus();
      return;
    }
    onApply(draft, draftCategory);
    close();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="lane-filter-trigger"
        onClick={open}
        aria-haspopup="dialog"
        aria-controls="menu-filter-dialog"
      >
        <svg
          viewBox="0 0 20 20"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
        >
          <path d="M2 5h16M2 10h16M2 15h16M6 3v4m8 1v4m-5 1v4" />
        </svg>
        Sort &amp; Filter
      </button>
      <dialog
        ref={dialog}
        id="menu-filter-dialog"
        className="lane-filter-dialog"
        aria-labelledby="menu-filter-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <form onSubmit={submit}>
          <header>
            <h2 id="menu-filter-title">Sort &amp; Filter</h2>
            <button type="button" className="lane-filter-close" aria-label="Close filters" onClick={close}>
              ×
            </button>
          </header>
          <label className="lane-filter-field">
            <span>Sort by</span>
            <select
              value={draft.sort}
              onChange={(event) => setDraft({ ...draft, sort: event.target.value as Filters['sort'] })}
            >
              {SORTS.map(({ value, label }) => (
                <option key={value} value={value} disabled={!canSort(value)}>
                  {label}
                  {!canSort(value) ? ' · data unavailable' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="lane-filter-field">
            <span>Category</span>
            <select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value as Category)}>
              {categories.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Price range in AUD</legend>
            <div className="lane-filter-prices">
              <label>
                <span>Minimum price</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={draft.min}
                  onChange={(event) => {
                    setError('');
                    setDraft({ ...draft, min: event.target.value });
                  }}
                />
              </label>
              <label>
                <span>Maximum price</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  id="menu-filter-max"
                  value={draft.max}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'menu-filter-error' : undefined}
                  onChange={(event) => {
                    setError('');
                    setDraft({ ...draft, max: event.target.value });
                  }}
                />
              </label>
            </div>
            {error && (
              <p className="lane-error" id="menu-filter-error" role="alert">
                {error}
              </p>
            )}
            <p className="lane-filter-note">
              For dishes with options, the lowest listed price in range determines the sort order.
            </p>
          </fieldset>
          <fieldset>
            <legend>Price type</legend>
            <div className="lane-filter-segments">
              {PRICE_TYPES.map(({ value, label }) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    checked={draft.kind === value}
                    onChange={() => setDraft({ ...draft, kind: value })}
                  />
                  <span>{label}</span>
                  <span className="lane-filter-check" aria-hidden="true">
                    ✓
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <footer>
            <button
              type="button"
              className={ctaClass({ variant: 'editorial', className: 'lane-text-link' })}
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                setDraftCategory('all');
                setError('');
              }}
            >
              Reset filters
            </button>
            <button type="submit" className={ctaClass({ compact: true })}>
              Apply filters
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
