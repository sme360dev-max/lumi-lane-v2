'use client';

import { gsap } from 'gsap';
import { useLayoutEffect, type Dispatch, type RefObject } from 'react';
import { STAMP_GOAL, type StampAction, type StampState } from './stamp-state';

export function useStampMotion(root: RefObject<HTMLDivElement | null>, state: StampState, dispatch: Dispatch<StampAction>) {
  const striking = state.phase === 'pressing' || state.phase === 'imprint';
  const target = state.phase === 'imprint' ? state.count - 1 : state.count;
  const unlocking = state.phase === 'unlocking';

  useLayoutEffect(() => {
    const scene = root.current;
    if (!striking || !scene) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dispatch({ type: 'impact' });
      dispatch({ type: 'settle' });
      return;
    }

    const stage = scene.querySelector<HTMLElement>('[data-stamp-stage]')!;
    const slot = stage.querySelector<HTMLElement>(`[data-stamp-slot="${target}"]`)!;
    const anchor = stage.querySelector<HTMLElement>('[data-stamp-anchor]')!;
    const tool = anchor.querySelector<HTMLElement>('[data-stamp-tool]')!;
    const shadow = stage.querySelector<HTMLElement>('[data-stamp-shadow]')!;

    // Animate a normalized flight path so resizing can remeasure the landing point without restarting the purchase.
    const flight = { travel: 0, lift: 0, descent: 0 };
    const geometry = { homeX: 0, homeY: 0, dx: 0, dy: 0, hover: 0 };
    const toolX = gsap.quickSetter(tool, 'x', 'px');
    const toolY = gsap.quickSetter(tool, 'y', 'px');
    const shadowX = gsap.quickSetter(shadow, 'x', 'px');
    const shadowY = gsap.quickSetter(shadow, 'y', 'px');

    const render = () => {
      const x = geometry.dx * flight.travel;
      const y = geometry.dy * flight.travel;
      toolX(x);
      toolY(y - geometry.hover * (flight.travel - flight.descent) + flight.lift);
      shadowX(geometry.homeX + x);
      shadowY(geometry.homeY + y);
    };
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      const home = anchor.getBoundingClientRect();
      const position = slot.getBoundingClientRect();
      geometry.homeX = home.left + home.width / 2 - bounds.left;
      geometry.homeY = home.bottom - 4 - bounds.top;
      geometry.dx = position.left + position.width / 2 - bounds.left - geometry.homeX;
      geometry.dy = position.top + position.height / 2 - bounds.top - geometry.homeY;
      geometry.hover = Number.parseFloat(getComputedStyle(stage).getPropertyValue('--stamp-hover'));
      render();
    };

    const motion = gsap.context(() => {
      gsap.set([tool, shadow], { x: 0, y: 0 });
      measure();
      const timeline = gsap.timeline({ onUpdate: render, onComplete: () => dispatch({ type: 'settle' }) });
      timeline
        .fromTo('[data-stamp-receipt]', { y: -5, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out' }, 0)
        .to(flight, { lift: -22, duration: 0.27, ease: 'power2.out' }, 0.09)
        .to(tool, { rotationX: -12, rotationY: 12, rotationZ: -5, duration: 0.29, ease: 'power2.out' }, 0.09)
        .to(shadow, { scale: 1.24, opacity: 0.25, duration: 0.31 }, 0.19)
        .to(flight, { travel: 1, duration: 0.53, ease: 'power2.inOut' }, 0.24)
        .to(flight, { lift: 0, duration: 0.39, ease: 'sine.inOut' }, 0.38)
        .to(tool, { rotationX: 0, rotationY: 0, rotationZ: 0, duration: 0.35, ease: 'sine.inOut' }, 0.49)
        .to(flight, { descent: 1, duration: 0.2, ease: 'power3.in' }, 0.78)
        .to(shadow, { scale: 0.74, opacity: 0.82, duration: 0.2, ease: 'power3.in' }, 0.78)
        .addLabel('impact', 0.98)
        .call(() => dispatch({ type: 'impact' }), [], 'impact')
        .fromTo(slot.querySelector('svg'), { opacity: 0.12, clipPath: 'circle(6%)', scale: 1.06 }, { opacity: 1, clipPath: 'circle(75%)', scale: 1, duration: 0.34, immediateRender: false, ease: 'power2.out' }, 'impact')
        .to('[data-card-rig]', { y: 4, scaleX: 1.008, scaleY: 0.982, duration: 0.07, ease: 'power3.out' }, 'impact')
        .to('[data-card-rig]', { y: 0, scaleX: 1, scaleY: 1, duration: 0.34, ease: 'power3.out' }, 1.05)
        .to(flight, { descent: 0, lift: -16, duration: 0.25, ease: 'power3.out' }, 1.04)
        .to(shadow, { scale: 1.14, opacity: 0.23, duration: 0.29, ease: 'power2.out' }, 1.04)
        .fromTo('[data-stamp-counter]', { y: 4, opacity: 0.55 }, { y: 0, opacity: 1, duration: 0.32, immediateRender: false }, 'impact')
        .fromTo('[data-stamp-progress]', { scaleX: target / STAMP_GOAL }, { scaleX: (target + 1) / STAMP_GOAL, duration: 0.36, immediateRender: false, ease: 'power2.out' }, 'impact')
        .fromTo('[data-stamp-plus]', { y: 4, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, immediateRender: false }, 1.04)
        .fromTo(slot.querySelector('[data-stamp-glint]'), { xPercent: -125, opacity: 0.65 }, { xPercent: 130, opacity: 0, duration: 0.49, immediateRender: false, ease: 'power2.out' }, 1.08)
        .to(flight, { travel: 0, duration: 0.47, ease: 'power2.inOut' }, 1.23)
        .to(flight, { lift: 0, duration: 0.27, ease: 'sine.inOut' }, 1.43)
        .to(tool, { rotationY: -8, rotationZ: 4, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 1.23)
        .to(shadow, { opacity: 0, duration: 0.28 }, 1.42)
        .to('[data-stamp-receipt]', { opacity: 0, duration: 0.24 }, 1.46);

      // Let the last impression and full meter read before turning the card over.
      if (target === STAMP_GOAL - 1) timeline.to({}, { duration: 0.25 });
    }, scene);

    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(slot);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      motion.revert();
    };
  }, [dispatch, root, striking, target]);

  useLayoutEffect(() => {
    const stage = root.current;
    if (!unlocking || !stage) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dispatch({ type: 'unlock' });
      return;
    }

    const motion = gsap.context(() => {
      gsap.timeline({ onComplete: () => dispatch({ type: 'unlock' }) })
        .fromTo('[data-card-shine]', { xPercent: -110, opacity: 0 }, { xPercent: 140, opacity: 0.85, duration: 0.56, ease: 'power2.out' }, 0)
        .to('[data-card-rig]', { y: -19, scale: 1.025, rotationX: -7, duration: 0.38, ease: 'power2.out' }, 0.2)
        .fromTo('[data-card-turn]', { rotationY: 0 }, { rotationY: -180, duration: 0.81, ease: 'power2.inOut' }, 0.31)
        .to('[data-card-rig]', { y: 0, scale: 1, rotationX: 0, duration: 0.47, ease: 'power3.out' }, 0.79);
    }, stage);

    return () => motion.revert();
  }, [dispatch, root, unlocking]);
}
