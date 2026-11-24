import { CtaLink } from '@/components/ui/Button';
import { BUSINESS } from '@/data/business';
import { ABOUT, BOOK, MENU_PAGE } from '@/data/content';
import { ExploreStage } from './ExploreStage';
import styles from './home-editorial.module.css';

/** Each line describes what its page really offers today. */
const destinations = [
  {
    href: '/menu/',
    title: 'Menu',
    description: MENU_PAGE.intro,
    action: ABOUT.ctaLabel,
  },
  {
    href: '/book/',
    title: BOOK.eyebrow,
    description: 'Send a table request. The venue team will contact you to confirm.',
    action: 'Request a table',
  },
  {
    href: '/loyalty/',
    title: 'Loyalty',
    description: 'Earn points on completed orders with your Lumi Lane account, then unlock reward credit.',
    action: 'See how rewards work',
  },
] as const;

export function HomeEditorial() {
  return (
    <div className={styles.editorial}>
      <section aria-labelledby="home-brand-title" className={`site-container ${styles.intro}`}>
        <p className={styles.eyebrow}>
          {BUSINESS.name} · {BUSINESS.address.locality}
        </p>
        <h2 id="home-brand-title">
          A coffee house <em>with a long table.</em>
        </h2>
        <p className={styles.introCopy}>{ABOUT.columns[0][0]}</p>
        <CtaLink href="/about/" variant="editorial" className={styles.action}>
          Read our story
        </CtaLink>
      </section>

      <section aria-labelledby="home-destinations-title" className={styles.showcase}>
        <ExploreStage>
          <span className={styles.scrim} aria-hidden="true" />
          <h2 id="home-destinations-title" className={styles.stageTitle}>
            <span className="title-line">
              <span>Explore</span>
            </span>{' '}
            <span className="title-line">
              <em>Lumi Lane</em>
            </span>
          </h2>
          <p className={styles.stageHint} aria-hidden="true">
            Move your cursor to see what is on the table.
          </p>
        </ExploreStage>
        <ul className={`site-container ${styles.destinations}`}>
          {destinations.map(({ href, title, description, action }) => (
            <li key={href} className={styles.destination}>
              <h3>{title}</h3>
              <p>{description}</p>
              <CtaLink href={href} variant="editorial" className={styles.action}>
                {action}
              </CtaLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
