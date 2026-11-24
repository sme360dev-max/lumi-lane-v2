'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ctaClass } from '@/components/ui/Button';
import { BagIcon } from '@/components/ui/ExperienceIcons';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import { HERO } from '@/data/content';
import { money } from '@/features/menu/catalog';
import { accountRequest, createRequestKey } from '@/lib/api';
import { useAccountSession } from '@/features/account/account-session';
import { clearCart, countItems, getCartLines, setQuantity, useCart } from './cart-state';

const BagContext = createContext<(trigger: HTMLElement) => void>(() => {});
const pictures = new Map<string, (typeof HERO.slides)[number]>(HERO.slides.map((slide) => [slide.menuId, slide]));

export function useOpenBag() {
  return useContext(BagContext);
}

export function ShoppingBag({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const openedOn = useRef<string | null>(null);
  const pressedBackdrop = useRef(false);
  const orderKey = useRef(createRequestKey());
  const [announcement, setAnnouncement] = useState('');
  const [rewardBalance, setRewardBalance] = useState(0);
  const [useReward, setUseReward] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState<{ id: string; totalCents: number } | null>(null);
  const accountSession = useAccountSession();
  const bag = useCart();
  const lines = getCartLines(bag);
  const count = countItems(bag);
  const subtotal = lines.reduce((total, item) => total + item.subtotal, 0);
  const estimatedReward = useReward ? Math.min(subtotal, rewardBalance) : 0;
  useEffect(() => {
    if (accountSession.status !== 'active') return;
    let current = true;
    void accountRequest<{ rewardBalanceCents: number }>('/api/account/rewards/')
      .then((data) => { if (current) setRewardBalance(data.rewardBalanceCents); })
      .catch(() => { if (current) setRewardBalance(0); });
    return () => { current = false; };
  }, [accountSession.status, accountSession.account?.id]);

  const placeOrder = async () => {
    setPlacingOrder(true);
    setCheckoutError('');
    try {
      const data = await accountRequest<{ order: { id: string; totalCents: number }; message: string }>('/api/account/orders/', {
        method: 'POST', body: JSON.stringify({ requestId: orderKey.current.for(JSON.stringify({ bag, useReward })), useReward }),
      });
      orderKey.current.reset();
      setOrderSuccess(data.order);
      clearCart();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Could not send your order.');
    } finally { setPlacingOrder(false); }
  };
  const open = useCallback(
    (trigger: HTMLElement) => {
      const panel = dialog.current;
      if (!panel || panel.open) return;
      returnFocus.current = trigger;
      openedOn.current = pathname;
      setAnnouncement('');
      const root = document.documentElement;
      root.style.setProperty('--cart-scrollbar-padding', `${window.innerWidth - root.clientWidth}px`);
      panel.showModal();
      closeButton.current?.focus({ preventScroll: true });
    },
    [pathname],
  );

  const close = () => dialog.current?.close();

  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--cart-scrollbar-padding');
    };
  }, []);

  useEffect(() => {
    const panel = dialog.current;
    if (pathname === '/menu/' && window.location.hash === '#shopping-bag') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      const trigger = document.getElementById('site-bag-trigger');
      if (trigger) open(trigger);
    } else if (panel?.open && openedOn.current !== pathname) {
      panel.close();
    }
  }, [open, pathname]);

  const containTab = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
    const first = controls[0];
    const last = controls[controls.length - 1];
    const next =
      event.shiftKey && document.activeElement === first
        ? last
        : !event.shiftKey && document.activeElement === last
          ? first
          : null;
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  const updateLine = (item: (typeof lines)[number], quantity: number) => {
    const name = item.label ? `${item.name}, ${item.label}` : item.name;
    if (quantity === 0) closeButton.current?.focus({ preventScroll: true });
    setQuantity(item.key, quantity);
    const newSubtotal = subtotal + (quantity - item.quantity) * item.cents;
    setAnnouncement(
      `${quantity ? `${name} quantity ${quantity}.` : `${name} removed.`} Subtotal ${money(newSubtotal)} AUD.`,
    );
  };

  return (
    <BagContext.Provider value={open}>
      {children}
      <dialog
        ref={dialog}
        id="shopping-bag"
        className="cart-drawer"
        aria-labelledby="shopping-bag-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          if (dialog.current?.open) return;
          document.documentElement.style.removeProperty('--cart-scrollbar-padding');
          returnFocus.current?.focus({ preventScroll: true });
          returnFocus.current = null;
        }}
        onKeyDown={containTab}
        onPointerDown={(event) => {
          pressedBackdrop.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          if (pressedBackdrop.current && event.target === event.currentTarget) close();
          pressedBackdrop.current = false;
        }}
      >
        <div className="cart-drawer-frame">
          <header className="cart-drawer-header">
            <div>
              <h2 id="shopping-bag-title">Your bag</h2>
              <p>
                {count} {count === 1 ? 'item' : 'items'}
              </p>
            </div>
            <button
              ref={closeButton}
              type="button"
              className="cart-close"
              aria-label="Close shopping bag"
              onClick={close}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
              </svg>
            </button>
          </header>
          <div className="cart-drawer-body">
            {orderSuccess ? (
              <div className="cart-drawer-empty" role="status">
                <div className="cart-empty-emblem"><BagIcon size={48} /></div>
                <h3>Your order request is <em>received.</em></h3>
                <p>Order {orderSuccess.id.slice(0, 8).toUpperCase()} has been sent to Lumi Lane. The team will confirm it; payment is due at pickup.</p>
                <button type="button" className={ctaClass()} onClick={() => { setOrderSuccess(null); close(); }}>Done</button>
              </div>
            ) : lines.length === 0 ? (
              <div className="cart-drawer-empty">
                <div className="cart-empty-emblem">
                  <BagIcon size={48} />
                </div>
                <h3>
                  A little room for <em>something good.</em>
                </h3>
                <p>Your bag is empty. Add a favourite from the menu to get started.</p>
                <Link href="/menu/" onClick={close} className={ctaClass({ variant: 'editorial', className: 'cart-browse' })}>
                  Browse menu
                </Link>
                <button type="button" className={ctaClass({ variant: 'editorial' })} onClick={close}>
                  Continue shopping
                </button>
              </div>
            ) : (
              <ul className="cart-drawer-lines" aria-label="Items in your bag">
                {lines.map((item) => {
                  const name = item.label ? `${item.name}, ${item.label}` : item.name;
                  const picture = pictures.get(item.itemId);
                  return (
                    <li key={item.key} className="cart-drawer-line" data-photo={Boolean(picture)}>
                      {picture && (
                        <div className="cart-line-picture">
                          <ResponsivePicture
                            name={picture.image}
                            widths={[480]}
                            sizes="64px"
                            width={480}
                            height={480}
                            alt=""
                          />
                        </div>
                      )}
                      <div className="cart-line-info">
                        <h3>{item.name}</h3>
                        {item.label && <p>{item.label}</p>}
                        <p>{money(item.cents)} each</p>
                      </div>
                      <strong className="cart-line-subtotal">{money(item.subtotal)}</strong>
                      <div className="cart-line-controls">
                        <QuantityStepper
                          label={name}
                          quantity={item.quantity}
                          onChange={(delta) => updateLine(item, item.quantity + delta)}
                        />
                        <button
                          type="button"
                          className={ctaClass({ variant: 'editorial', className: 'cart-remove' })}
                          aria-label={`Remove ${name} from bag`}
                          onClick={() => updateLine(item, 0)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {lines.length > 0 && (
            <div className="cart-drawer-summary">
              <p className="cart-summary-total"><span>Subtotal</span><strong data-testid="cart-subtotal">{money(subtotal)} AUD</strong></p>
              {rewardBalance > 0 && accountSession.status === 'active' && <label className="dashboard-preference"><span><strong>Use reward credit</strong><small>{money(rewardBalance)} AUD available</small></span><input type="checkbox" checked={useReward} onChange={(event) => setUseReward(event.target.checked)} /></label>}
              {estimatedReward > 0 && <p className="cart-summary-total"><span>Reward credit</span><strong>−{money(estimatedReward)} AUD</strong></p>}
              <p className="cart-summary-total"><span>Due at pickup</span><strong>{money(subtotal - estimatedReward)} AUD</strong></p>
              <p className="cart-summary-note" id="cart-checkout-note">Pickup order request. Payment is due at the venue after confirmation.</p>
              {accountSession.status === 'active' ? <button type="button" className={ctaClass({ className: 'cart-checkout' })} disabled={placingOrder} aria-describedby="cart-checkout-note" onClick={placeOrder}>{placingOrder ? 'Sending order…' : 'Send pickup order'}</button> : accountSession.status === 'signed-out' ? <Link href="/login/" onClick={close} className={ctaClass({ className: 'cart-checkout' })}>Log in to order</Link> : <button type="button" className={ctaClass({ className: 'cart-checkout' })} disabled>Checking account…</button>}
              {checkoutError && <p role="alert" className="booking-error">{checkoutError}</p>}
              <button type="button" className={ctaClass({ variant: 'editorial' })} onClick={close}>
                Continue shopping
              </button>
            </div>
          )}
          <p className="sr-only" role="status">
            {announcement}
          </p>
        </div>
      </dialog>
    </BagContext.Provider>
  );
}
