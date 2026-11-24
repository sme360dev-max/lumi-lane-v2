'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HEADER_NAV } from '@/data/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AccountActions } from './AccountActions';
import { MegaMenu } from './MegaMenu';
import { isActive } from './navStyles';

const DESKTOP = '(min-width: 1024px)';

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
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d={mobileOpen ? 'm6 6 12 12M18 6 6 18' : 'M4 8h16M4 16h16'} />
        </svg>
      </button>
      <div className="site-nav-panel" id="site-nav-panel">
        <ul className="site-nav-list" id="site-nav-items">
          {HEADER_NAV.map(({ href, label }) => {
            const active = isActive(pathname, href) ? 'page' : undefined;
            if (href === '/menu/') {
              return (
                <li key={href}>
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
              <li key={href}>
                <Link href={href} className="site-nav-link" aria-current={active} onClick={close}>
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="site-mobile-account">
          <AccountActions pathname={pathname} onNavigate={close} />
        </div>
      </div>
    </nav>
  );
}
