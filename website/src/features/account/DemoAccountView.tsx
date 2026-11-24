'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { ctaClass } from '@/components/ui/Button';
import { BagIcon } from '@/components/ui/ExperienceIcons';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import { useOpenBag } from '@/features/cart/CartDrawer';
import { AccountIcon } from './AccountIcon';
import { clearAccountSession, useAccountSession } from './account-session';
import { loadDashboard, useDashboardData } from './dashboard-data';
import { useFavorites } from './favorites';
import {
  AccountLink,
  AccountPanel,
  FavoritesPanel,
  OrderPanel,
  PreferencesPanel,
  ProfileAvatar,
  ProfileEditor,
  ReservationsPanel,
  RewardsPanel,
  SupportPanel,
} from './DashboardPanels';

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Active orders' },
  { id: 'history', label: 'Order history' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'profile', label: 'Edit profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'support', label: 'Help & support' },
] as const;
type Section = (typeof sections)[number]['id'];

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
function snapshot(): Section {
  return sections.find(({ id }) => id === window.location.hash.slice(1))?.id ?? 'overview';
}
const serverSnapshot = (): Section => 'overview';

const activity = [
  { id: 'history', title: 'Order history', text: 'No past orders yet.', action: 'View history' },
  { id: 'rewards', title: 'Rewards', text: 'No reward activity available.', action: 'View rewards' },
  { id: 'reservations', title: 'Reservations', text: 'No upcoming reservations.', action: 'View reservations' },
  { id: 'favorites', title: 'Favorites', text: 'No favorite dishes yet.', action: 'View favorites' },
] as const;

function SectionLink({ section, label }: { section: Section; label: string }) {
  return (
    <a href={`#${section}`} className={ctaClass({ variant: 'editorial' })}>
      {label}
    </a>
  );
}

function Overview() {
  const favorites = useFavorites();
  const { orders, reservations } = useDashboardData();
  const openBag = useOpenBag();
  const activeCount = orders.filter(({ status }) => !['completed', 'cancelled'].includes(status)).length;
  const pastCount = orders.filter(({ status }) => ['completed', 'cancelled'].includes(status)).length;
  return (
    <>
      <div className="dashboard-active">
        <div className="dashboard-active-copy">
          <p className="experience-kicker">Orders</p>
          <h2>Active orders</h2>
          <p>
            {activeCount ? `${activeCount} active pickup order${activeCount === 1 ? '' : 's'}.` : 'You have no active orders.'}
          </p>
          <div className="dashboard-actions">
            <Link href="/menu/" className={ctaClass({ variant: 'editorial' })}>
              Explore menu
            </Link>
            <button
              type="button"
              className={ctaClass({ variant: 'editorial' })}
              aria-haspopup="dialog"
              aria-controls="shopping-bag"
              onClick={(event) => openBag(event.currentTarget)}
            >
              Shopping bag <BagIcon size={17} />
            </button>
            <SectionLink section="orders" label="View active orders" />
          </div>
        </div>
        <span className="dashboard-active-icon" aria-hidden="true">
          <AccountIcon name="orders" />
        </span>
      </div>
      <div className="dashboard-activity">
        {activity.map(({ id, title, text, action }) => (
          <AccountPanel icon={id} title={title} key={id}>
            <p>
              {id === 'favorites' && favorites.length
                ? `${favorites.length} saved dish${favorites.length === 1 ? '' : 'es'}.`
                : id === 'history' && pastCount
                  ? `${pastCount} completed or cancelled order${pastCount === 1 ? '' : 's'}.`
                  : id === 'reservations' && reservations.length
                    ? `${reservations.length} table request${reservations.length === 1 ? '' : 's'} on your account.`
                    : text}
            </p>
            {id === 'rewards' ? (
              <AccountLink href="/loyalty/">Explore Loyalty</AccountLink>
            ) : (
              <SectionLink section={id} label={action} />
            )}
            {id === 'reservations' && <AccountLink href="/book/">Book a table</AccountLink>}
          </AccountPanel>
        ))}
      </div>
    </>
  );
}

function SectionContent({ section }: { section: Section }) {
  const { profile, preferences, orders, reservations, rewards } = useDashboardData();
  switch (section) {
    case 'overview':
      return <Overview />;
    case 'orders':
      return <OrderPanel history={false} orders={orders} />;
    case 'history':
      return <OrderPanel history orders={orders} />;
    case 'rewards':
      return <RewardsPanel rewards={rewards} />;
    case 'reservations':
      return <ReservationsPanel reservations={reservations} />;
    case 'favorites':
      return <FavoritesPanel />;
    case 'profile':
      return <ProfileEditor profile={profile} />;
    case 'preferences':
      return <PreferencesPanel preferences={preferences} />;
    case 'support':
      return <SupportPanel />;
  }
}

function Dashboard() {
  const section = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const { profile, preferences, loaded } = useDashboardData();
  const accountSession = useAccountSession();
  const router = useRouter();
  useEffect(() => { void loadDashboard().catch(() => undefined); }, []);
  const signOut = async () => {
    try {
      const { accountRequest } = await import('@/lib/api');
      await accountRequest('/api/account/logout/', { method: 'POST' });
    } catch { /* clear the local session even when the API is offline */ }
    clearAccountSession();
    router.replace('/login/');
  };

  if (!loaded || profile.id !== accountSession.account?.id) return <div className="site-container demo-account-intro"><p role="status">Loading your account…</p></div>;

  return (
    <div className="site-container dashboard-shell" data-compact={preferences.compact}>
      <aside className="dashboard-sidebar">
        <div className="dashboard-identity">
          <ProfileAvatar profile={profile} />
          <div>
            <strong>{profile.name}</strong>
            <p>{profile.email}</p>
            <span className="dashboard-demo">Lumi Lane account</span>
          </div>
        </div>
        <nav aria-label="Account sections" className="dashboard-nav">
          {sections.map(({ id, label }) => (
            <a key={id} className={ctaClass({ variant: 'navigation' })} href={`#${id}`} aria-current={section === id ? 'location' : undefined}>
              <AccountIcon name={id} /> {label}
            </a>
          ))}
        </nav>
        <label className="dashboard-mobile-nav">
          <span className="experience-kicker">Account section</span>
          <select
            value={section}
            onChange={(event) => {
              window.location.hash = event.target.value;
            }}
          >
            {sections.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={ctaClass({ variant: 'navigation', className: 'dashboard-signout' })} onClick={signOut}>
          <AccountIcon name="exit" /> Sign out
        </button>
      </aside>
      <div className="dashboard-content">
        <header className="dashboard-greeting">
          <div>
            <p className="experience-kicker">Lumi Lane · My account</p>
            <h1>
              Your <em>account.</em>
            </h1>
            <p>Welcome, {profile.name}. Manage your account, orders and reservations.</p>
            {section === 'overview' && <SectionLink section="profile" label="Edit profile" />}
          </div>
          <div className="dashboard-greeting-photo">
            <ResponsivePicture name="coffee" widths={[480, 800]} sizes="230px" width={800} height={800} alt="" />
          </div>
        </header>
        <div key={section} className="dashboard-view">
          <SectionContent section={section} />
        </div>
      </div>
    </div>
  );
}

export function DemoAccountView() {
  const session = useAccountSession();
  return (
    <div className="lane-page demo-account">
      {session.status === 'active' ? (
        <Dashboard />
      ) : (
        <div className="site-container demo-account-intro">
          <p className="experience-kicker">Lumi Lane account</p>
          <h1 className="lane-title">
            Your <em>account.</em>
          </h1>
          <p>
            {session.status === 'signed-out' ? 'Sign in to view your account details.' : 'Checking your account…'}
          </p>
          {session.status === 'signed-out' && <AccountLink href="/login/">Log in</AccountLink>}
        </div>
      )}
    </div>
  );
}
