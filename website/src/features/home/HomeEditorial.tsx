import { CtaLink } from '@/components/ui/Button';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import { BUSINESS } from '@/data/business';
import { ABOUT, BOOK, MENU_PAGE, VISIT } from '@/data/content';
import { HomeEditorialMotion } from './HomeEditorialMotion';
import styles from './home-editorial.module.css';

const destinations = [
  {
    href: '/menu/',
    title: 'Explore the Menu',
    description: MENU_PAGE.intro,
    action: ABOUT.ctaLabel,
    photo: { name: 'mezze', alt: 'Mezze board with hummus, beetroot dip, olives and pita', width: 1254, height: 1254 },
  },
  {
    href: '/book/',
    title: BOOK.eyebrow,
    description: BOOK.subIntro,
    action: 'Booking details',
    photo: { name: 'storefront', alt: VISIT.storefrontAlt, width: 1360, height: 972 },
  },
  {
    href: '/loyalty/',
    title: 'Loyalty',
    description: 'Ask the team about loyalty next time you visit Lumi Lane in Lightsview.',
    action: 'Explore Loyalty',
    photo: { name: 'coffee', alt: 'Latte with leaf art, seen from above', width: 1254, height: 1254 },
  },
] as const;

export function HomeEditorial() {
  return (
    <HomeEditorialMotion className={styles.editorial}>
      <section aria-labelledby="home-brand-title" className={`site-container ${styles.intro}`}>
        <p className={styles.eyebrow}>
          {BUSINESS.name} · {BUSINESS.address.locality}
        </p>
        <h2 id="home-brand-title" data-home-reveal>
          A coffee house <em>with a long table.</em>
        </h2>
        <p className={styles.introCopy}>{ABOUT.columns[0][0]}</p>
        <CtaLink href="/about/" variant="editorial" className={styles.action}>
          Read our story
        </CtaLink>
      </section>

      <section aria-labelledby="home-destinations-title" className={`site-container ${styles.showcase}`}>
        <h2 id="home-destinations-title" className={styles.showcaseTitle}>
          Explore Lumi Lane
        </h2>
        <ul className={styles.grid}>
          {destinations.map(({ href, title, description, action, photo }) => (
            <li key={href} className={styles.feature}>
              <div className={styles.photo} data-subject={photo.name} data-home-reveal>
                <ResponsivePicture
                  {...photo}
                  widths={[480, 800]}
                  sizes="(min-width: 1600px) 450px, (min-width: 740px) 28vw, 89vw"
                />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <CtaLink href={href} variant="editorial" className={styles.action}>
                {action}
              </CtaLink>
            </li>
          ))}
        </ul>
      </section>
    </HomeEditorialMotion>
  );
}
