'use client';

import { gsap } from 'gsap';
import { CtaLink } from '@/components/ui/Button';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import { HERO } from '@/data/content';
import { HERO_DISHES } from './heroDishes';
import {
  SLOT_COUNT,
  SPLIT_QUERY,
  computeLayout,
  dishOfSlot,
  nearestSlotForDish,
  rotationForSlot,
  slotAngle,
  slotPosition,
  type TableLayout,
} from './heroTable';

const N = HERO_DISHES.length;
/** Autoplay dwell per dish (s). */
const DWELL = 6.5;
/** Table turn between dishes (s). */
const TURN = 1.25;
const PLATE_SIZES = '(min-width: 1024px) 36vw, 66vw';

// useLayoutEffect warns during static prerender; the effect only matters in the browser.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface Controller {
  next: () => void;
  prev: () => void;
  show: (dish: number) => void;
  setPlaying: (on: boolean) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const ctrl = useRef<Controller | null>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlayingState] = useState(true);
  const [announce, setAnnounce] = useState(false);

  useIsoLayoutEffect(() => {
    const section = sectionRef.current;
    const text = textRef.current;
    const wrap = wrapRef.current;
    const rotor = rotorRef.current;
    if (!section || !text || !wrap || !rotor) return;
    const host: HTMLElement = section; // non-null alias for the hoisted goToSlot()

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // One entry per dish: every masked line of its title AND its description/price/CTA block.
    const panels = HERO_DISHES.map((_, i) =>
      Array.from(
        section.querySelectorAll<HTMLElement>(
          `[data-hero-panel="${i}"] .hero-rise, [data-hero-panel-body="${i}"] .hero-rise`,
        ),
      ),
    );
    const rises = (p: HTMLElement[]) => p;
    const chrome = Array.from(section.querySelectorAll<HTMLElement>('[data-hero-chrome]'));
    const fills = Array.from(section.querySelectorAll<HTMLElement>('[data-hero-fill]'));

    let layout: TableLayout;
    let slot = 0; // slot currently (or about to be) featured
    let tl: gsap.core.Timeline | null = null;
    let progress: gsap.core.Tween | null = null;
    let wantPlay = !reduce; // user preference (pause button)
    let hover = false;
    let focusWithin = false;
    let inView = true;

    const measure = () => {
      const box = section.getBoundingClientRect();
      const t = text.getBoundingClientRect();
      layout = computeLayout({
        width: box.width,
        height: box.height,
        textRight: t.right - box.left,
        textBottom: t.bottom - box.top,
        // Must agree with the CSS split/stacked switch, which measures the viewport incl. scrollbar.
        mode: window.matchMedia(SPLIT_QUERY).matches ? 'split' : 'stacked',
      });
      wrap.style.width = wrap.style.height = `${(layout.r * 2).toFixed(1)}px`;
      wrap.style.left = `${(layout.cx - layout.r).toFixed(1)}px`;
      wrap.style.top = `${(layout.cy - layout.r).toFixed(1)}px`;
      rotor.style.setProperty('--featured', `${layout.featuredAngle}deg`);
      section.dataset.mode = layout.mode;
    };

    /** Snap everything to the settled state of the current slot (resize, reduced motion, first paint). */
    const settle = () => {
      const d = dishOfSlot(slot, N);
      gsap.set(wrap, { x: 0, y: 0, scale: 1, autoAlpha: 1 });
      gsap.set(rotor, { rotation: rotationForSlot(slot, layout.featuredAngle) });
      panels.forEach((p, i) =>
        gsap.set(rises(p), i === d ? { yPercent: 0, opacity: 1 } : { yPercent: 110, opacity: 0 }),
      );
      gsap.set(chrome, { opacity: 1 });
      gsap.set(section, { backgroundColor: HERO_DISHES[d]!.bg, '--accent': HERO_DISHES[d]!.accent });
      section.dataset.state = 'idle';
    };
    /** Exposed as data-state for QA/tests: pending → intro → idle ⇄ turning. */
    function idle() {
      host.dataset.state = 'idle';
      startProgress();
    }

    const shouldRun = () => wantPlay && !hover && !focusWithin && inView && !document.hidden;

    /** Autoplay: the active dash fills over DWELL seconds, then the table turns to the next dish. */
    const startProgress = () => {
      progress?.kill();
      gsap.set(fills, { scaleX: 0 });
      if (!wantPlay) return;
      const fill = fills[dishOfSlot(slot, N)];
      if (!fill) return;
      progress = gsap.to(fill, { scaleX: 1, duration: DWELL, ease: 'none', onComplete: () => goToSlot(slot + 1) });
      if (!shouldRun()) progress.pause();
    };
    const syncProgress = () => {
      if (!progress) return;
      if (shouldRun()) progress.resume();
      else progress.pause();
    };

    function goToSlot(target: number) {
      if (target === slot && tl?.isActive()) return;
      slot = target;
      host.classList.remove('hero-pending');
      const d = dishOfSlot(slot, N);
      const dish = HERO_DISHES[d]!;
      setActive(d);
      tl?.kill();
      progress?.kill();
      gsap.set(fills, { scaleX: 0 });

      if (reduce) {
        settle();
        startProgress();
        return;
      }

      host.dataset.state = 'turning';
      tl = gsap.timeline({ onComplete: idle });
      // 1. The table turns (and finishes any interrupted intro glide) — the signature move.
      tl.to(wrap, { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: TURN, ease: 'power3.inOut' }, 0)
        .to(rotor, { rotation: rotationForSlot(slot, layout.featuredAngle), duration: TURN, ease: 'power3.inOut' }, 0)
        // 2. Background and accent shift with the turn.
        .to(
          section,
          { backgroundColor: dish.bg, '--accent': dish.accent, duration: TURN * 0.9, ease: 'power2.inOut' },
          0,
        )
        .to(chrome, { opacity: 1, duration: 0.3 }, 0);
      // 3. Outgoing copy lifts away while the plates move…
      panels.forEach((p, i) => {
        if (i !== d)
          tl!.to(rises(p), { yPercent: -110, opacity: 0, duration: 0.42, ease: 'power2.in', stagger: 0.035 }, 0);
      });
      // 4. …and the new copy rises into its masks as the dish arrives in the featured seat.
      tl.fromTo(
        rises(panels[d]!),
        { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.85, ease: 'power3.out', stagger: 0.06 },
        TURN * 0.3,
      );
    }

    const intro = () => {
      const { intro: pose } = layout;
      const from = {
        x: pose.cx - layout.cx,
        y: pose.cy - layout.cy,
        scale: pose.scale,
      };
      gsap.set(wrap, { ...from, autoAlpha: 0 });
      gsap.set(rotor, { rotation: rotationForSlot(slot, layout.featuredAngle) + 64 });
      panels.forEach((p) => gsap.set(rises(p), { yPercent: 110, opacity: 0 }));
      gsap.set(chrome, { opacity: 0 });
      gsap.set(section, { backgroundColor: HERO_DISHES[0]!.bg, '--accent': HERO_DISHES[0]!.accent });
      section.classList.remove('hero-pending');

      section.dataset.state = 'intro';
      tl = gsap.timeline({ onComplete: idle, delay: 0.15 });
      tl.to(wrap, { autoAlpha: 1, duration: 0.6, ease: 'power1.out' }, 0)
        // Whole table, centred, slowly turning — then it glides off to the corner and grows.
        .to(rotor, { rotation: rotationForSlot(slot, layout.featuredAngle), duration: 2.3, ease: 'power3.inOut' }, 0)
        .to(wrap, { x: 0, y: 0, scale: 1, duration: 1.55, ease: 'power3.inOut' }, 0.75)
        .to(rises(panels[0]!), { yPercent: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.07 }, 1.75)
        .to(chrome, { opacity: 1, duration: 0.7, ease: 'power2.out', stagger: 0.08 }, 1.95);
    };

    measure();
    let cancelled = false;
    if (reduce) {
      section.classList.remove('hero-pending');
      settle();
    } else {
      // Give the first plate photos a moment to decode so the table never glides in empty.
      const imgs = Array.from(rotor.querySelectorAll<HTMLImageElement>('img')).slice(0, N);
      const ready = Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
      const timeout = new Promise((r) => window.setTimeout(r, 1400));
      void Promise.race([ready, timeout]).then(() => {
        if (!cancelled && !tl) intro();
      });
    }

    ctrl.current = {
      next: () => goToSlot(slot + 1),
      prev: () => goToSlot(slot - 1),
      show: (dish) => goToSlot(nearestSlotForDish(dish, slot, N)),
      setPlaying: (on) => {
        wantPlay = on;
        setPlayingState(on);
        if (on) {
          if (!progress || !progress.isActive()) {
            if (!tl?.isActive()) startProgress();
          }
          syncProgress();
        } else {
          progress?.kill();
          progress = null;
          gsap.set(fills, { scaleX: 0 });
        }
      },
    };
    if (reduce) setPlayingState(false);

    // Pause on hover / keyboard focus, when the tab is hidden, or when the hero is scrolled away.
    const onEnter = () => ((hover = true), syncProgress());
    const onLeave = () => ((hover = false), syncProgress());
    const onFocusIn = () => {
      focusWithin = true;
      setAnnounce(true);
      syncProgress();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (section.contains(e.relatedTarget as Node | null)) return;
      focusWithin = false;
      syncProgress();
    };
    const onVisibility = () => syncProgress();
    section.addEventListener('pointerenter', onEnter);
    section.addEventListener('pointerleave', onLeave);
    section.addEventListener('focusin', onFocusIn);
    section.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', onVisibility);
    const io = new IntersectionObserver(([e]) => {
      inView = !!e?.isIntersecting;
      syncProgress();
    });
    io.observe(section);

    // Swipe on touch screens (horizontal only, so vertical page scroll is untouched).
    let start: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || (e.target as Element).closest('a,button')) return;
      start = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        setAnnounce(true);
        goToSlot(slot + (dx < 0 ? 1 : -1));
      }
    };
    const onCancel = () => (start = null);
    section.addEventListener('pointerdown', onDown);
    section.addEventListener('pointerup', onUp);
    section.addEventListener('pointercancel', onCancel);

    // Re-fit the table on resize; an in-flight turn is completed instantly rather than distorted.
    let resizeTimer: number | undefined;
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        // Mobile browsers fire resize when the URL bar collapses; ignore those small height-only changes.
        if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 90) return;
        lastW = window.innerWidth;
        lastH = window.innerHeight;
        const wasRunning = !!tl?.isActive();
        tl?.progress(1);
        measure();
        settle();
        if (wasRunning) startProgress();
      }, 120);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      ctrl.current = null;
      tl?.kill();
      progress?.kill();
      io.disconnect();
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      section.removeEventListener('pointerenter', onEnter);
      section.removeEventListener('pointerleave', onLeave);
      section.removeEventListener('focusin', onFocusIn);
      section.removeEventListener('focusout', onFocusOut);
      section.removeEventListener('pointerdown', onDown);
      section.removeEventListener('pointerup', onUp);
      section.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('visibilitychange', onVisibility);
      gsap.killTweensOf([wrap, rotor, section, ...chrome, ...fills, ...panels.flat()]);
    };
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') ctrl.current?.next();
    else if (e.key === 'ArrowLeft') ctrl.current?.prev();
    else return;
    setAnnounce(true);
    e.preventDefault();
  }, []);

  /** Button / dash input: announce the change to screen readers, then drive the table. */
  const act = useCallback((action: 'next' | 'prev' | number) => {
    setAnnounce(true);
    const c = ctrl.current;
    if (!c) return;
    if (action === 'next') c.next();
    else if (action === 'prev') c.prev();
    else c.show(action);
  }, []);
  const togglePlay = useCallback(() => ctrl.current?.setPlaying(!playing), [playing]);

  const first = HERO_DISHES[0]!;
  const current = HERO_DISHES[active]!;

  return (
    <section
      ref={sectionRef}
      aria-roledescription="carousel"
      aria-labelledby="hero-headline"
      onKeyDown={onKeyDown}
      className="hero hero-pending relative isolate overflow-hidden text-shell"
      style={{ backgroundColor: first.bg, '--accent': first.accent } as CSSProperties}
      data-active={active}
      data-state="pending"
    >
      {/* The tabletop. wrap = position/scale (intro glide), rotor = rotation (the carousel). */}
      <div ref={wrapRef} className="hero-table-wrap" aria-hidden="true">
        <div className="hero-table-shadow" />
        <div ref={rotorRef} className="hero-table">
          <svg className="hero-engraving" viewBox="0 0 1000 1000">
            <defs>
              <path id="hero-engraving-path" d="M500,500 m-178,0 a178,178 0 1,1 356,0 a178,178 0 1,1 -356,0" />
            </defs>
            <circle cx="500" cy="500" r="211" />
            <circle cx="500" cy="500" r="150" />
            <text x="500" y="525" textAnchor="middle" className="hero-table-monogram">
              LL
            </text>
            <text>
              <textPath href="#hero-engraving-path" textLength="1110" lengthAdjust="spacing">
                {HERO.engraving}
              </textPath>
            </text>
          </svg>
          {Array.from({ length: SLOT_COUNT }, (_, j) => {
            const dish = HERO_DISHES[dishOfSlot(j, N)]!;
            const pos = slotPosition(j);
            return (
              <div
                key={j}
                className="hero-plate"
                data-dish={dishOfSlot(j, N)}
                style={{ left: `${pos.left}%`, top: `${pos.top}%`, '--a': `${slotAngle(j)}deg` } as CSSProperties}
              >
                <ResponsivePicture
                  name={dish.image}
                  widths={[480, 800, 1254]}
                  sizes={PLATE_SIZES}
                  width={1254}
                  height={1254}
                  alt=""
                  className={`hero-plate-img hero-plate-img--${dish.image}`}
                  priority={j < N}
                  fetchPriority={j === 0 ? 'high' : 'auto'}
                />
              </div>
            );
          })}
          <span className="hero-table-fold" />
        </div>
        <div className="hero-table-light" />
      </div>

      {/* Left information panel */}
      <div className="hero-copy">
        <div ref={textRef} className="hero-copy-inner">
          <p className="hero-eyebrow" data-hero-chrome>
            {HERO.eyebrow}
          </p>
          <h1 id="hero-headline" className="hero-stack hero-title font-heading">
            <span className="sr-only">{HERO.srTitle} </span>
            {HERO_DISHES.map((d, i) => (
              <span key={d.menuId} className="hero-layer" data-hero-panel={i} aria-hidden={i !== active}>
                <span className="hero-mask hero-meta-row">
                  <span className="hero-rise hero-meta">
                    <span>
                      <span className="text-[color:var(--accent)]">{pad(i + 1)}</span>
                      <span className="opacity-50"> / {pad(N)}</span>
                    </span>{' '}
                    <span className="opacity-70">{d.section}</span>
                  </span>
                </span>
                <span className="hero-mask">
                  <span className="hero-rise block">{d.title[0]}</span>
                </span>
                <span className="hero-mask">
                  <span className="hero-rise block italic" style={{ color: d.accent }}>
                    {d.title[1]}
                  </span>
                </span>
              </span>
            ))}
          </h1>

          <div className="hero-stack mt-5 sm:mt-6">
            {HERO_DISHES.map((d, i) => (
              <div
                key={d.menuId}
                className="hero-layer"
                data-hero-panel-body={i}
                aria-hidden={i !== active}
                inert={i !== active}
              >
                <span className="hero-mask">
                  <p className="hero-rise hero-caption">{d.caption}</p>
                  <p className="hero-rise hero-desc">{d.description}</p>
                </span>
                <span className="hero-action-row">
                  <span className="hero-rise hero-buy">
                    <span className="font-body tabular-nums text-[1.9rem] leading-none sm:text-[2.2rem]" data-price>
                      {d.price}
                    </span>
                    <CtaLink variant="editorial" href={`/menu/#${d.categoryHash}`} className="hero-cta">
                      {HERO.viewLabel}
                      <span className="sr-only">: {d.name}</span>
                    </CtaLink>
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="hero-controls" data-hero-chrome>
            <button type="button" className="hero-arrow" aria-label="Previous dish" onClick={() => act('prev')}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M14 8H3M7 4L3 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <ol className="hero-dashes" aria-label="Dishes">
              {HERO_DISHES.map((d, i) => (
                <li key={d.menuId}>
                  <button
                    type="button"
                    className="hero-dash"
                    aria-label={`Dish ${i + 1} of ${N}: ${d.name}`}
                    aria-current={i === active ? 'true' : undefined}
                    onClick={() => act(i)}
                  >
                    <span className="hero-dash-track">
                      <span className="hero-dash-fill" data-hero-fill />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="hero-arrow hero-arrow--next"
              aria-label="Next dish"
              onClick={() => act('next')}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button
              type="button"
              className="hero-pause"
              aria-label={playing ? 'Pause dish rotation' : 'Play dish rotation'}
              aria-pressed={!playing}
              onClick={togglePlay}
            >
              {playing ? (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3l8 5-8 5z" fill="currentColor" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live={announce ? 'polite' : 'off'} aria-atomic="true">
        {`Dish ${active + 1} of ${N}: ${current.name}, ${current.price}`}
      </p>
      <noscript>
        <style>{`.hero-pending .hero-rise,.hero-pending [data-hero-chrome],.hero-pending .hero-table-wrap{opacity:1!important;visibility:visible!important}`}</style>
      </noscript>
    </section>
  );
}
