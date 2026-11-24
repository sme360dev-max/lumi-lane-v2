'use client';

import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { ctaClass } from '@/components/ui/Button';
import { hasReward, initialStampState, isCollecting, isInMotion, STAMP_GOAL, STAMP_STORAGE_KEY, stampReducer } from './stamp-state';
import { useStampMotion } from './useStampMotion';
import styles from './stamp-ritual.module.css';

function CoffeeSeal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 1.8 49.2 5l9.8 10.5 3.2 16.5L59 48.5 49.2 59 32 62.2 14.8 59 5 48.5 1.8 32 5 15.5 14.8 5 32 1.8Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M32 6.5 46.7 9.2l8.3 9 2.7 13.8-2.7 13.8-8.3 9L32 57.5l-14.7-2.7-8.3-9L6.3 32l2.7-13.8 8.3-9L32 6.5Z" stroke="currentColor" strokeWidth=".65" />
      <path d="M17 34h25v2.5a11 11 0 0 1-11 11h-3a11 11 0 0 1-11-11V34Zm25.2 1.1h3.2a3.3 3.3 0 0 1 0 6.6h-4.2M18 50h25M25 29c-4-5 5-5 2-10m5 10c-4-5 5-5 2-10m5 10c-4-5 5-5 2-10" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 28h3m-1.5-1.5v3m32-2h3m-1.5-1.5v3" stroke="currentColor" strokeWidth=".75" strokeLinecap="round" />
    </svg>
  );
}

function TurnIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 9a7.5 7.5 0 1 1 .8 8.6M5 4v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function StampRitual() {
  const [state, dispatch] = useReducer(stampReducer, initialStampState);
  const [confirmReset, setConfirmReset] = useState(false);
  const [seeStamps, setSeeStamps] = useState(false);
  const scene = useRef<HTMLDivElement>(null);
  const flip = useRef<HTMLButtonElement>(null);
  const earnButton = useRef<HTMLButtonElement>(null);
  const resetToggle = useRef<HTMLButtonElement>(null);
  const previousPhase = useRef(state.phase);
  const { count, phase, restored } = state;
  const striking = phase === 'pressing' || phase === 'imprint';
  const reward = hasReward(state);
  const busy = !restored || isInMotion(state);
  const remaining = STAMP_GOAL - count;
  const rewardFace = reward && !seeStamps;
  const flipped = phase === 'preview';
  const disabledEarn = busy || !isCollecting(state);
  const remainingText = remaining === 0
    ? 'All eight stamps collected.'
    : `${remaining} ${remaining === 1 ? 'stamp' : 'stamps'} to your demo reward.`;

  useStampMotion(scene, state, dispatch);

  useEffect(() => {
    let saved = 0;
    try { saved = Number(window.localStorage.getItem(STAMP_STORAGE_KEY)); } catch { /* In-memory demo still works. */ }
    dispatch({ type: 'restore', count: saved });
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { window.localStorage.setItem(STAMP_STORAGE_KEY, String(count)); } catch { /* In-memory demo still works. */ }
  }, [count, restored]);

  useEffect(() => {
    if (phase === 'unlocked' && previousPhase.current === 'unlocking') flip.current?.focus();
    if (phase === 'redeemed' || (phase === 'idle' && count === 0 && previousPhase.current !== 'idle')) earnButton.current?.focus();
    previousPhase.current = phase;
  }, [count, phase]);

  let announcement = `${count} of ${STAMP_GOAL} stamps. ${remainingText}`;
  if (phase === 'pressing') announcement = 'Demo purchase simulated. Applying one coffee stamp.';
  if (phase === 'imprint' || phase === 'earned') announcement = `One stamp added. ${announcement}`;
  if (phase === 'unlocked') announcement = 'Your demo coffee reward is unlocked. Flip the reward ticket to try redemption.';
  if (phase === 'redeemed') announcement = 'Demo reward redeemed. Your new stamp cycle starts at zero.';

  return (
      <section id="coffee-club-demo" tabIndex={-1} className={`page-masthead ${styles.ritual}`} aria-labelledby="stamp-ritual-title" data-phase={phase}>
        <div ref={scene} className={`site-container ${styles.layout}`}>
          <header className={styles.intro}>
            <p className={styles.eyebrow}>Try the Demo</p>
            <h2 id="stamp-ritual-title"><span>The Stamp</span>{' '}<span>Ritual.</span></h2>
            <p id="stamp-ritual-explanation" className={styles.disclosure}>Try a demo purchase to add one stamp to this card. It won’t place an order or earn a real reward.</p>
          </header>

          <div className={styles.object}>
            <div className={styles.stage} data-stamp-stage data-reward-face={rewardFace}>
              <div className={styles.cardRig} data-card-rig>
                <div className={styles.cardTurn} data-card-turn>
                  <div className={`${styles.face} ${styles.cardFront}`} aria-hidden={rewardFace}>
                    <div className={styles.cardHeader}>
                      <div><span className={styles.cardBrand}>Lumi Lane</span><p>Coffee Club</p></div>
                      <span className={styles.cardEdition}>Demo card<br />Lightsview, SA</span>
                    </div>
                    <ol className={styles.slots} aria-label="Coffee stamp positions">
                      {Array.from({ length: STAMP_GOAL }, (_, index) => {
                        const filled = index < count;
                        const active = phase === 'pressing' && index === count;
                        return (
                          <li key={index} className={styles.slot} data-stamp-slot={index} data-filled={filled} data-active={active}>
                            <span className="sr-only">Stamp {index + 1}{filled ? ', collected' : active ? ', being applied' : ', empty'}</span>
                            <span className={styles.slotNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                            <CoffeeSeal className={styles.imprint} />
                            <span className={styles.imprintLight} aria-hidden="true"><span data-stamp-glint /></span>
                          </li>
                        );
                      })}
                    </ol>
                    <div className={styles.cardBase}><span>One stamp per eligible coffee</span><span>Collect {STAMP_GOAL}</span></div>
                    <span aria-hidden="true" className={styles.cardShine} data-card-shine />
                  </div>
                  <div className={`${styles.face} ${styles.cardReward}`} aria-hidden={!rewardFace}>
                    <CoffeeSeal className={styles.rewardSeal} />
                    <p className={styles.kicker}>Eight of eight collected</p>
                    <p className={styles.rewardTitle}>Your coffee reward<br />is unlocked.</p>
                    <p className={styles.rewardDisclaimer}>Demo reward · Not valid for redemption</p>
                  </div>
                </div>
              </div>

              <span aria-hidden="true" className={styles.shadow} data-stamp-shadow />
              <div className={styles.tool} data-stamp-anchor aria-hidden="true">
                <span className={styles.toolBody} data-stamp-tool>
                  <span className={styles.toolHandle}><span>LL</span></span>
                  <span className={styles.toolStem} />
                  <span className={styles.toolFoot} data-stamp-heel />
                </span>
              </div>
            </div>

            {reward && (
              <section className={styles.ticketArea} aria-labelledby="coffee-reward-title">
                <h2 id="coffee-reward-title" className="sr-only">Demo coffee reward ticket</h2>
                <div className={styles.ticketPerspective} data-flipped={flipped}>
                  <div className={styles.ticketTurn}>
                    <div className={`${styles.ticketFace} ${styles.ticketFront}`} aria-hidden={flipped}>
                      <div><p className={styles.kicker}>Lumi Lane Coffee Club</p><p className={styles.ticketHeading}>One standard coffee.</p></div>
                      <CoffeeSeal className={styles.ticketSeal} />
                      <p className={styles.ticketDisclaimer}>Demo reward · Not valid for redemption</p>
                    </div>
                    <div className={`${styles.ticketFace} ${styles.ticketBack}`} aria-hidden={!flipped}>
                      <div><p className={styles.kicker}>Proposed reward</p><p>Demo redemption starts a fresh stamp card. No coffee is issued.</p></div>
                      <p className={styles.ticketDisclaimer}>Demo reward · Not valid for redemption</p>
                    </div>
                  </div>
                </div>
                <div className={styles.ticketActions}>
                  <button ref={flip} type="button" className={styles.textButton} aria-pressed={flipped} onClick={() => dispatch({ type: 'flip' })}>
                    <TurnIcon /> Flip reward ticket
                  </button>
                  {flipped && <button type="button" className={ctaClass({ compact: true, className: styles.primary })}
                    onClick={() => { setConfirmReset(false); setSeeStamps(false); dispatch({ type: 'redeem' }); }}>Redeem demo reward</button>}
                </div>
              </section>
            )}
          </div>

          <div className={styles.desk} data-ui>
            <div className={styles.progressHeading}>
              <h3>Stamp progress</h3>
              <p className={styles.counter} aria-hidden="true"><span data-stamp-counter>{String(count).padStart(2, '0')}</span> / 08</p>
            </div>
            <div className={styles.progress} role="progressbar" aria-label="Stamp progress" aria-valuemin={0} aria-valuemax={STAMP_GOAL} aria-valuenow={count}
              style={{ '--stamps': count / STAMP_GOAL } as CSSProperties}><span data-stamp-progress /></div>
            <div className={styles.feedback}>
              <p>{remainingText}</p>
              <span className={styles.plus} data-stamp-plus aria-hidden="true">+1 stamp</span>
            </div>

            <p role="status" className="sr-only">{announcement}</p>
            {striking && <div className={styles.receipt} data-stamp-receipt aria-hidden="true"><span aria-hidden="true">✦</span><p><strong>Demo purchase simulated</strong><br />Applying one coffee stamp.</p></div>}
            {phase === 'redeemed' && <p className={styles.redeemed}>Demo redeemed. A new stamp card is ready.</p>}

            {!reward && <button ref={earnButton} type="button" className={ctaClass({ className: styles.primary })} aria-disabled={disabledEarn} aria-describedby="stamp-ritual-explanation"
              onClick={() => { if (!disabledEarn) { setConfirmReset(false); dispatch({ type: 'earn' }); } }}>Try a Demo Purchase</button>}

            <div className={styles.controls} aria-label="Demo controls" role="group">
              {reward ? (
                <>
                  <button type="button" className={styles.textButton} aria-pressed={seeStamps} onClick={() => setSeeStamps(!seeStamps)}>View completed card</button>
                  <button type="button" className={styles.textButton} onClick={() => { setConfirmReset(false); setSeeStamps(false); dispatch({ type: 'replay' }); }}>Replay unlock</button>
                </>
              ) : (
                <>
                  <button type="button" className={styles.textButton} aria-disabled={busy || count === 0} onClick={() => dispatch({ type: 'undo' })}>Undo last stamp</button>
                  <button type="button" className={styles.textButton} aria-disabled={busy || !isCollecting(state) || count === STAMP_GOAL - 1}
                    onClick={() => { if (!busy && isCollecting(state) && count < STAMP_GOAL - 1) dispatch({ type: 'example' }); }}>Load 7/8 example</button>
                </>
              )}
              <button ref={resetToggle} type="button" className={styles.textButton} aria-disabled={busy || count === 0} aria-expanded={confirmReset}
                onClick={() => { if (!busy && count > 0) setConfirmReset(!confirmReset); }}>Reset progress</button>
            </div>

            {confirmReset && <div className={styles.confirm}>
              <p>Start over and clear your demo stamps?</p>
              <button className={styles.textButton} type="button" onClick={() => { setConfirmReset(false); resetToggle.current?.focus(); }}>Cancel</button>
              <button className={styles.textButton} type="button" aria-disabled={busy}
                onClick={() => { if (!busy) { earnButton.current?.focus(); setConfirmReset(false); setSeeStamps(false); dispatch({ type: 'reset' }); } }}>Reset demo progress</button>
            </div>}
          </div>
        </div>
      </section>
  );
}
