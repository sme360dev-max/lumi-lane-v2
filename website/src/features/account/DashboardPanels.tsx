'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ctaClass } from '@/components/ui/Button';
import { ExternalArrow } from '@/components/ui/ExperienceIcons';
import { changeQuantity, useCart } from '@/features/cart/cart-state';
import { useOpenBag } from '@/features/cart/CartDrawer';
import { buildCatalog, money } from '@/features/menu/catalog';
import { useMenuCategories } from '@/features/menu/menu-data';
import { MenuItemRow } from '@/features/menu/MenuItems';
import { BUSINESS, DIRECTIONS_URL } from '@/data/business';
import { AccountIcon, type AccountIconName } from './AccountIcon';
import {
  initials,
  saveDashboard,
  validateProfile,
  type AccountOrder,
  type Preferences,
  type Profile,
  type Reservation,
  type Rewards,
} from './dashboard-data';
import { useFavorites } from './favorites';

export function AccountPanel({ icon, title, children }: { icon: AccountIconName; title: string; children: ReactNode }) {
  return (
    <section className="dashboard-panel">
      <header>
        <span className="dashboard-icon">
          <AccountIcon name={icon} />
        </span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function AccountLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={ctaClass({ variant: 'editorial' })}>
      {children}
    </Link>
  );
}

export function ProfileAvatar({ profile }: { profile: Profile }) {
  return (
    <span className="dashboard-avatar" data-tone={profile.avatar} aria-hidden="true">
      {initials(profile.name)}
    </span>
  );
}

const profileFields = [
  { key: 'name', label: 'Full name', type: 'text', autoComplete: 'name' },
  { key: 'email', label: 'Email address', type: 'email', autoComplete: 'email' },
  { key: 'phone', label: 'Phone (optional)', type: 'tel', autoComplete: 'tel' },
] as const;

export function ProfileEditor({ profile }: { profile: Profile }) {
  const [draft, setDraft] = useState(profile);
  const [errors, setErrors] = useState<ReturnType<typeof validateProfile>>({});
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateProfile(draft);
    setErrors(result);
    const firstInvalid = profileFields.find(({ key }) => result[key]);
    if (firstInvalid) {
      setNotice('');
      const field = event.currentTarget.elements.namedItem(firstInvalid.key);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    const next = { ...draft, name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() };
    setSaving(true);
    try {
      await saveDashboard({ profile: next });
      setDraft(next);
      setNotice('Profile saved.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <AccountPanel icon="profile" title="Edit profile">
      <p>Update the details associated with your Lumi Lane account.</p>
      <form className="dashboard-form" noValidate onSubmit={submit}>
        {profileFields.map(({ key, label, type, autoComplete }) => (
          <div key={key} className="account-field">
            <label htmlFor={`profile-${key}`}>{label}</label>
            <input
              id={`profile-${key}`}
              name={key}
              type={type}
              value={draft[key]}
              autoComplete={autoComplete}
              aria-invalid={Boolean(errors[key])}
              aria-describedby={errors[key] ? `profile-error-${key}` : undefined}
              onChange={(event) => {
                setDraft({ ...draft, [key]: event.target.value });
                setErrors({ ...errors, [key]: undefined });
                setNotice('');
              }}
            />
            {errors[key] && (
              <p role="alert" className="account-error" id={`profile-error-${key}`}>
                {errors[key]}
              </p>
            )}
          </div>
        ))}
        <fieldset className="dashboard-avatar-options">
          <legend>Initials avatar</legend>
          {(['clay', 'espresso'] as const).map((tone) => (
            <label key={tone}>
              <input
                type="radio"
                name="avatar"
                checked={draft.avatar === tone}
                onChange={() => {
                  setDraft({ ...draft, avatar: tone });
                  setNotice('');
                }}
              />
              <ProfileAvatar profile={{ ...draft, avatar: tone }} /> {tone === 'clay' ? 'Terracotta' : 'Espresso'}
            </label>
          ))}
        </fieldset>
        <div className="dashboard-actions">
          <button type="submit" className={ctaClass()} disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          <button
            type="button"
            className={ctaClass({ variant: 'editorial' })}
            onClick={() => {
              setDraft(profile);
              setErrors({});
              setNotice('Edits discarded.');
            }}
          >
            Cancel edits
          </button>
        </div>
        <p role="status" className="dashboard-notice">
          {notice}
        </p>
      </form>
    </AccountPanel>
  );
}

function OrderDetails({ order, history }: { order: AccountOrder; history: boolean }) {
  const openBag = useOpenBag();
  return (
    <details className="dashboard-order">
      <summary>
        <span>
            <strong>Order {order.id.slice(0, 8).toUpperCase()}</strong>
          <small>{new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(`${order.date}T12:00:00`))}</small>
        </span>
        <span>{order.statusLabel}</span>
      </summary>
      <div className="dashboard-order-body">
        <ul className="dashboard-order-items">
          {order.items.map(({ key, name, label, quantity, cents }) => (
            <li key={key}>
              <span>
                {quantity} × {name}{label ? ` (${label})` : ''}
              </span>
              <strong>{money(cents * quantity)}</strong>
            </li>
          ))}
        </ul>
        <p className="dashboard-order-total">
          <span>Order total</span>
          <strong>{money(order.totalCents)} AUD</strong>
        </p>
        {history && order.items.length > 0 && (
          <button
            type="button"
            className={ctaClass()}
            onClick={(event) => {
              order.items.forEach(({ key, quantity }) => changeQuantity(key, quantity));
              openBag(event.currentTarget);
            }}
          >
            Reorder example items
          </button>
        )}
      </div>
    </details>
  );
}

export function OrderPanel({ history, orders }: { history: boolean; orders: AccountOrder[] }) {
  const rows = orders.filter((order) => history ? ['completed', 'cancelled'].includes(order.status) : !['completed', 'cancelled'].includes(order.status));
  return (
    <AccountPanel icon={history ? 'history' : 'orders'} title={history ? 'Order history' : 'Active orders'}>
      {rows.length > 0 ? (
        <>
          <p className="dashboard-example-label">Pickup orders · Payment is due at the venue.</p>
          {rows.map((order) => (
            <OrderDetails order={order} history={history} key={order.id} />
          ))}
        </>
      ) : (
        <div className="dashboard-empty">
          <p>{history ? 'No past orders yet.' : 'You have no active orders.'}</p>
          <p>{history ? 'Completed or cancelled orders will appear here.' : 'Orders you place will appear here while the venue prepares them.'}</p>
          <AccountLink href="/menu/">Explore menu</AccountLink>
        </div>
      )}
    </AccountPanel>
  );
}

export function ReservationsPanel({ reservations }: { reservations: Reservation[] }) {
  const [period, setPeriod] = useState<'upcoming' | 'past'>('upcoming');
  return (
    <AccountPanel icon="reservations" title="Reservations">
      <div className="dashboard-segments" role="group" aria-label="Reservation period">
        {(['upcoming', 'past'] as const).map((choice) => (
          <button key={choice} type="button" aria-pressed={period === choice} onClick={() => setPeriod(choice)}>
            {choice === 'upcoming' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </div>
      {(() => {
        const dateParts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        const part = (type: string) => dateParts.find(({ type: current }) => current === type)?.value ?? '';
        const today = `${part('year')}-${part('month')}-${part('day')}`;
        const visible = reservations.filter((row) => period === 'upcoming' ? row.date >= today : row.date < today);
        return visible.length ? <ul className="dashboard-order-items">{visible.map((row) => <li key={row.id}><span><strong>{new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(`${row.date}T12:00:00`))} · {row.time}</strong><br />{row.guests} guests · {row.status}</span></li>)}</ul> : <div className="dashboard-empty" role="status"><p>{period === 'upcoming' ? 'No upcoming reservations.' : 'No past reservations.'}</p></div>;
      })()}
      <AccountLink href="/book/">Book a table</AccountLink>
    </AccountPanel>
  );
}

export function FavoritesPanel() {
  const favorites = useFavorites();
  const bag = useCart();
  const categories = useMenuCategories();
  const items = buildCatalog(categories).filter(({ item }) => favorites.includes(item.id));
  return (
    <AccountPanel icon="favorites" title="Favorites">
      {items.length ? (
        <ul className="dashboard-favorites" aria-label="Saved menu items">
          {items.map((entry) => (
            <MenuItemRow key={entry.item.id} entry={entry} bag={bag} favorite />
          ))}
        </ul>
      ) : (
        <div className="dashboard-empty">
          <p>No favorite dishes yet.</p>
          <p>Use the heart beside any dish to save it on this device.</p>
        </div>
      )}
      <AccountLink href="/menu/">Browse the menu</AccountLink>
    </AccountPanel>
  );
}

export function PreferencesPanel({ preferences }: { preferences: Preferences }) {
  return (
    <AccountPanel icon="preferences" title="Preferences">
      <p>Your display preferences sync with your account.</p>
      <label className="dashboard-preference">
        <span>
          <strong>Compact dashboard</strong>
          <small>Use tighter spacing between account sections.</small>
        </span>
        <input
          type="checkbox"
          checked={preferences.compact}
          onChange={(event) => { void saveDashboard({ preferences: { compact: event.target.checked } }).catch(() => undefined); }}
        />
      </label>
    </AccountPanel>
  );
}

export function RewardsPanel({ rewards }: { rewards: Rewards }) {
  const program = rewards.program;
  return (
    <AccountPanel icon="rewards" title="Rewards">
      {program?.active ? <div className="dashboard-empty">
        <p><strong>{rewards.points}</strong> points toward a reward.</p>
        <p>Earn {program.pointsPerOrder} point(s) for each completed order. {program.pointsForReward} points unlock {money(program.rewardCents)} AUD credit.</p>
        <p>Available reward credit: <strong>{money(rewards.rewardBalanceCents)} AUD</strong>.</p>
        {rewards.entries.length > 0 && <ul className="dashboard-order-items" aria-label="Rewards activity">{rewards.entries.slice(0, 8).map((entry, index) => <li key={`${entry.createdAt}-${index}`}><span>{entry.description}</span><strong>{entry.points ? `${entry.points > 0 ? '+' : ''}${entry.points} pts` : `${entry.amountCents > 0 ? '+' : ''}${money(entry.amountCents)} AUD`}</strong></li>)}</ul>}
      </div> : <div className="dashboard-empty"><p>The loyalty program is currently paused.</p></div>}
      <AccountLink href="/loyalty/">Explore Loyalty</AccountLink>
    </AccountPanel>
  );
}

export function SupportPanel() {
  return (
    <AccountPanel icon="support" title="Help & support">
      <p>For help with a visit or a reservation, contact the venue directly.</p>
      <div className="dashboard-actions">
        <a href={BUSINESS.phone.href} className={ctaClass({ variant: 'editorial' })}>
          Call {BUSINESS.phone.display}
        </a>
        <a href={DIRECTIONS_URL} className={ctaClass({ variant: 'editorial' })} target="_blank" rel="noopener noreferrer">
          Get directions <ExternalArrow />
        </a>
        <AccountLink href="/visit/">Visit information</AccountLink>
      </div>
      <small>Listed number · confirm with venue.</small>
      <details className="dashboard-help">
        <summary>Where are my demo changes stored?</summary>
        <p>Your profile, orders and rewards sync to your Lumi Lane account. Favorites and your shopping bag are also saved with the account when you sign in.</p>
      </details>
    </AccountPanel>
  );
}
