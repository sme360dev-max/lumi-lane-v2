import { CtaLink, ctaClass } from '@/components/ui/Button';
import { ExternalArrow } from '@/components/ui/ExperienceIcons';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import { BUSINESS, DIRECTIONS_URL } from '@/data/business';
import { VISIT } from '@/data/content';

export function VisitView() {
  return (
    <div className="lane-page lane-visit">
      <section className="lane-visit-arrival site-container" aria-labelledby="visit-title">
        <header className="lane-visit-intro">
          <div>
            <p className="lane-kicker">Lightsview · South Australia</p>
            <h1 className="lane-title" id="visit-title">
              Visit <em>us.</em>
            </h1>
            <p>{VISIT.title}</p>
          </div>
          <div className="lane-visit-actions">
            <a href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" className={ctaClass({ variant: 'editorial' })}>
              Get directions
            </a>
            <CtaLink href="/book/">
              Book a Table
            </CtaLink>
          </div>
        </header>
        <figure className="lane-visit-photo">
          <ResponsivePicture
            name="storefront"
            widths={[480, 800, 1200]}
            sizes="(min-width: 1600px) 1390px, 89vw"
            width={1360}
            height={972}
            alt={VISIT.storefrontAlt}
            priority
            fetchPriority="high"
          />
          <figcaption>Fosters Road, Lightsview</figcaption>
        </figure>
      </section>
      <section className="lane-visit-details site-container" aria-label="Location and hours">
        <div className="lane-visit-address">
          <p className="lane-kicker">Where to find us</p>
          <h2>
            On Fosters <em>Road.</em>
          </h2>
          <address>
            {BUSINESS.address.line1}
            <br />
            {BUSINESS.address.line2}
          </address>
          <h3>{VISIT.gettingHereTitle}</h3>
          <p>{VISIT.gettingHere}</p>
          <a href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" className={ctaClass({ variant: 'editorial', className: 'lane-text-link' })}>
            Open directions in Google Maps <ExternalArrow />
          </a>
        </div>
        <div className="lane-visit-hours">
          <h2>
            Opening <em>hours.</em>
          </h2>
          <dl>
            {BUSINESS.hours.map(({ label, time }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{time}</dd>
              </div>
            ))}
          </dl>
          <p>The public centre listing gives different closing times. Confirm hours before visiting.</p>
        </div>
      </section>
      <section className="lane-visit-contact">
        <div className="site-container">
          <div>
            <h2>
              Get in <em>touch.</em>
            </h2>
            <a className="lane-phone" href={BUSINESS.phone.href}>
              {BUSINESS.phone.display}
            </a>
            <p>Listed phone number. Confirm directly with Lumi Lane.</p>
          </div>
          <ul>
            {BUSINESS.social.map(({ id, label, href }) => (
              <li key={id}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={ctaClass({ variant: 'navigation' })}
                >
                  {id === 'instagram' ? BUSINESS.instagramHandle : label.replace('Lumi Lane on ', '')}
                  <ExternalArrow />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
