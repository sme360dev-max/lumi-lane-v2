'use client';

import { useState } from 'react';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { changeQuantity } from '@/features/cart/cart-state';
import { toggleFavorite } from '@/features/account/favorites';
import { money, type CatalogItem } from './catalog';

export function MenuItemRow({
  entry,
  bag,
  showSection,
  favorite,
}: {
  entry: CatalogItem;
  bag: Readonly<Record<string, number>>;
  showSection?: boolean;
  favorite: boolean;
}) {
  const { item, choices, section } = entry;
  const [selected, setSelected] = useState('');
  const option = choices.length === 1 ? choices[0] : choices.find(({ key }) => key === selected);
  const description = item.kind === 'wine' ? item.region : item.description;
  const value = option ? (bag[option.key] ?? 0) : 0;
  const displayName = option?.label ? `${item.name}, ${option.label}` : item.name;

  return (
    <li className="lane-menu-item" data-item-id={item.id} data-compact-row={choices.length === 1 && !showSection}>
      <div className="lane-item-text">
        {showSection && <p className="lane-item-section">{section}</p>}
        <div className="lane-item-line">
          <h4>{item.name}</h4>
          <span className="lane-item-leader" aria-hidden="true" />
          {item.kind === 'std' ? (
            <p className="lane-item-price">
              {item.price.startsWith('$') ? null : '$'}
              <span data-price>{item.price}</span>
            </p>
          ) : item.kind === 'wine' ? (
            <p className="lane-item-price">
              <span>
                <small>Glass</small> {item.glass}
              </span>
              <span>
                <small>Bottle</small> {item.bottle}
              </span>
            </p>
          ) : (
            <p className="lane-item-price">
              <small>From</small> {money(Math.min(...choices.map(({ cents }) => cents)))}
            </p>
          )}
        </div>
        {description && <p className="lane-item-description">{description}</p>}
      </div>
      <div className="lane-item-controls">
        {choices.length > 1 && (
          <label className="lane-item-option">
            <span className="sr-only">Choose an option for {item.name}</span>
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">Choose an option</option>
              {choices.map(({ key, label, price }) => (
                <option key={key} value={key}>
                  {label} · {price.startsWith('$') ? price : `$${price}`}
                </option>
              ))}
            </select>
          </label>
        )}
        {option ? (
          <QuantityStepper
            label={displayName}
            quantity={value}
            onChange={(delta) => changeQuantity(option.key, delta)}
          />
        ) : (
          choices.length > 0 && <span className="lane-choice-hint">Choose an option to add</span>
        )}
        <button
          type="button"
          className="lane-favorite"
          aria-pressed={favorite}
          aria-label={`Favorite ${item.name}`}
          onClick={() => toggleFavorite(item.id)}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <path
              d="M12 20.4 4.7 13a4.5 4.5 0 0 1 6.4-6.4l.9.9.9-.9a4.5 4.5 0 0 1 6.4 6.4Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </li>
  );
}
