'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BUSINESS } from '@/data/business';
import { HEADER_NAV } from '@/data/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AccountActions } from './AccountActions';
import { MegaMenu } from './MegaMenu';
import { isActive } from './navStyles';

const DESKTOP = '(min-width: 1024px)';
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function PrimaryNav() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const desktop = useMediaQuery(DESKTOP);
  const canHover = useMediaQuery(`${DESKTOP} and (hover: hover) and (pointer: fine)`);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [mobileOpenOn, setMobileOpenOn] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const trigger = useRef<HTMLButtonElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const megaOpen = canHover && openOn === pathname;
  const mobileOpen = !desktop && mobileOpenOn === pathname;

  const cancel = useCallback(() => window.clearTimeout(timer.current), []);
  const close = useCallback(() => {
    cancel();
    setOpenOn(null);
    setMobileOpenOn(null);
  }, [cancel]);
  const schedule = (open: boolean, delay: number) => {
    cancel();
    timer.current = window.setTimeout(() => setOpenOn(open ? pathname : null), delay);
  };

  useEffect(() => cancel, [cancel, pathname]);

  useEffect(() => {
    if (!megaOpen && !mobileOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (mobileOpen) mobileTrigger.current?.focus();
      else if (document.activeElement?.closest('#mega')) trigger.current?.focus();
      close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (mobileOpen && !nav.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('keydown', onEscape);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [close, megaOpen, mobileOpen]);

  // The active-page underline is one element that slides to whichever link is current.
  useIsomorphicLayoutEffect(() => {
    const host = panel.current;
    const bar = host?.closest<HTMLElement>('.site-header');
    if (!host || !bar) return;
    const place = () => {
      const label = host.querySelector<HTMLElement>('.site-nav-link[aria-current="page"] > span');
      if (!label || !desktop) {
        host.dataset.indicator = 'none';
        return;
      }
      // The rule is positioned against the masthead itself (its nearest positioned ancestor).
      const from = bar.getBoundingClientRect();
      const to = label.getBoundingClientRect();
      host.style.setProperty('--indicator-x', `${to.left - from.left}px`);
      host.style.setProperty('--indicator-y', `${to.bottom - from.top - 1.5}px`);
      host.style.setProperty('--indicator-width', `${to.width}px`);
      // Appear in place the first time; slide only between two known positions.
      host.dataset.indicator = !host.dataset.indicator || host.dataset.indicator === 'none' ? 'placed' : 'sliding';
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(bar);
    void document.fonts?.ready.then(place);
    return () => observer.disconnect();
  }, [pathname, desktop]);

  return (
    <nav
      ref={nav}
      aria-label="Primary"
      className="site-nav"
      data-mobile-open={mobileOpen}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        if (mobileOpen) close();
        else schedule(false, 100);
      }}
    >
      <button
        ref={mobileTrigger}
        type="button"
        className="site-nav-toggle"
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
        aria-controls="site-nav-panel"
        onClick={() => {
          close();
          setMobileOpenOn(mobileOpen ? null : pathname);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d={mobileOpen ? 'm6 6 12 12M18 6 6 18' : 'M4 9h16M4 15h16'} />
        </svg>
      </button>
      <div ref={panel} className="site-nav-panel" id="site-nav-panel">
        <ul className="site-nav-list" id="site-nav-items">
          {HEADER_NAV.map(({ href, label }, index) => {
            const active = isActive(pathname, href) ? 'page' : undefined;
            const order = { '--i': index } as CSSProperties;
            if (href === '/menu/') {
              return (
                <li key={href} style={order}>
                  <button
                    ref={trigger}
                    type="button"
                    className="site-nav-link"
                    aria-haspopup={canHover ? 'dialog' : undefined}
                    aria-expanded={canHover ? megaOpen : undefined}
                    aria-controls={canHover ? 'mega' : undefined}
                    aria-current={active}
                    onMouseEnter={() => canHover && schedule(true, 100)}
                    onMouseLeave={() => canHover && schedule(false, 250)}
                    onFocus={() => canHover && schedule(true, 0)}
                    onClick={() => {
                      close();
                      router.push(href);
                    }}
                  >
                    <span>{label}</span>
                  </button>
                  <MegaMenu
                    open={megaOpen}
                    onClose={close}
                    onDismiss={() => {
                      trigger.current?.focus();
                      close();
                    }}
                    onPanelEnter={cancel}
                    onPanelLeave={() => schedule(false, 160)}
                  />
                </li>
              );
            }
            return (
              <li key={href} style={order}>
                <Link href={href} className="site-nav-link" aria-current={active} onClick={close}>
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <span className="site-nav-indicator" aria-hidden="true" />
        <div className="site-mobile-account">
          <AccountActions pathname={pathname} onNavigate={close} />
        </div>
        <p className="site-nav-venue">
          <span>
            {BUSINESS.address.line1} {BUSINESS.address.line2}
          </span>
          {BUSINESS.hours.map(({ label, time }) => (
            <span key={label}>
              {label}, {time}
            </span>
          ))}
        </p>
      </div>
    </nav>
  );
}
