'use client';

import { CtaLink, ctaClass } from '@/components/ui/Button';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import { CoffeeClubStepsMotion } from './CoffeeClubStepsMotion';
import { useLoyaltyProgram } from './program';
import { money } from '@/features/menu/catalog';
import styles from './coffee-club-guide.module.css';

function StepIcon({ kind }: { kind: 'cup' | 'stamp' | 'reward' }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'cup' && <path d="M6 14h16v5a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7v-5Zm16 1h2a3.5 3.5 0 1 1 0 7h-3M4 28h22M11 10c-3-3 3-4 1-7m5 7c-3-3 3-4 1-7" />}
      {kind === 'stamp' && <path d="M7 23h18v4H7v-4Zm2 0v-2a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2m-10-5 1-5a4 4 0 1 1 4 0l1 5M7 30h18" />}
      {kind === 'reward' && <path d="M5 8h22v5a3 3 0 0 0 0 6v5H5v-5a3 3 0 0 0 0-6V8Zm7 6h7v2.5a3.5 3.5 0 0 1-7 0V14Zm7 0h1a1.5 1.5 0 0 1 0 3h-1" />}
    </svg>
  );
}

function DownArrow() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2.5v10.75m-4-4 4 4 4-4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function CoffeeClubGuide() {
  const program = useLoyaltyProgram();
  const steps = [
    { icon: 'cup' as const, title: 'Place an order', description: 'Order with your Lumi Lane account.' },
    { icon: 'stamp' as const, title: 'Earn points', description: `Receive ${program.pointsPerOrder} point(s) when your order is completed.` },
    { icon: 'reward' as const, title: 'Unlock credit', description: `${program.pointsForReward} points unlock ${money(program.rewardCents)} AUD reward credit.` },
  ];
  return (
    <section className={`page-masthead ${styles.guide}`} aria-labelledby="coffee-club-title">
      <div className={`site-container ${styles.opening}`}>
        <div className={styles.openingCopy}>
          <p className={styles.eyebrow}>Lumi Lane rewards</p>
          <h1 id="coffee-club-title"><span>{program.pointsForReward} points.</span>{' '}<em>{money(program.rewardCents)} credit.</em></h1>
          <p className={styles.promise}>{program.active ? `Earn ${program.pointsPerOrder} point(s) when each order is completed. Use reward credit on a future pickup order.` : 'The loyalty program is currently paused.'}</p>
          <a href="#coffee-club-how" className={ctaClass({ className: styles.explore })}>Explore Coffee Club <DownArrow /></a>
        </div>
        <div className={styles.coffee} aria-hidden="true">
          <ResponsivePicture name="coffee" widths={[480, 800]} sizes="(max-width: 620px) 58vw, (min-width: 1350px) 342px, 27vw" alt="" width={1254} height={1254} className={styles.coffeeImage} priority />
        </div>
      </div>

      <CoffeeClubStepsMotion className={`site-container ${styles.how}`}>
        <div className={styles.howHeading}>
          <h2 id="coffee-club-how" tabIndex={-1}>How Coffee Club Works</h2>
          <p>Rules are managed by Lumi Lane.</p>
        </div>
        <ol className={styles.steps}>
          {steps.map(({ icon, title, description }) => (
            <li key={icon} className={styles.step} data-coffee-step>
              <span className={styles.stepIcon}><StepIcon kind={icon} /></span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </li>
          ))}
        </ol>
        <a className={ctaClass({ variant: 'editorial', className: styles.jump })} href="/account/#rewards">View your rewards <DownArrow /></a>
      </CoffeeClubStepsMotion>
    </section>
  );
}

export function CoffeeClubDetails() {
  const program = useLoyaltyProgram();
  const faq = [
    ['How do I earn points?', `You earn ${program.pointsPerOrder} point(s) for every order the venue marks as completed.`],
    ['How many points are needed?', `${program.pointsForReward} points unlock ${money(program.rewardCents)} AUD reward credit.`],
    ['How do I use reward credit?', 'Sign in, add items to your shopping bag and choose to apply your available reward credit when sending a pickup order request. Any remaining amount is due at pickup.'],
    ['Do I need an account?', 'Yes. Points and reward credit are attached to your Lumi Lane account.'],
  ];
  return (
    <section className={styles.details} aria-labelledby="coffee-club-reward">
      <div className={`site-container ${styles.detailsInner}`}>
        <div className={styles.rewardCopy}>
          <h2 id="coffee-club-reward">{money(program.rewardCents)} AUD credit.</h2>
          <p>Complete {program.pointsForReward} points to add reward credit to your Lumi Lane account.</p>
        </div>
        <div className={styles.faq}>
          <h2>Coffee Club FAQ</h2>
          {faq.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
        <nav aria-label="Explore Lumi Lane after Coffee Club" className={styles.links}>
          <CtaLink href="/menu/" variant="editorial">Explore the menu</CtaLink>
          <CtaLink href="/visit/" variant="editorial">Visit Us</CtaLink>
        </nav>
      </div>
    </section>
  );
}
