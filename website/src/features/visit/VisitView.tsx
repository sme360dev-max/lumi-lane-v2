import { CtaLink, ctaClass } from '@/components/ui/Button';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import { BUSINESS, DIRECTIONS_URL } from '@/data/business';
import { VISIT } from '@/data/content';

export function VisitView() {
  return (
    <div className="lane-page lane-visit">
      <section className="lane-visit-arrival site-container" aria-labelledby="visit-title">
        <div className="lane-visit-intro">
          <p className="lane-kicker">Lightsview · South Australia</p>
          <h1 className="lane-title" id="visit-title">
            <span className="title-line">
              <span>
                Visit <em>us.</em>
              </span>
            </span>
          </h1>
          <p className="lane-visit-deck">{VISIT.title}</p>

          <dl className="lane-facts">
            <div>
              <dt>Address</dt>
              <dd>
                <address>
                  {BUSINESS.address.line1}
                  <br />
                  {BUSINESS.address.line2}
                </address>
              </dd>
            </div>
            <div>
              <dt>Hours</dt>
              <dd>
                <ul className="lane-facts-hours">
                  {BUSINESS.hours.map(({ label, time }) => (
                    <li key={label}>
                      <span>{label}</span>
                      <span>{time}</span>
                    </li>
                  ))}
                </ul>
                <small>The public centre listing gives different closing times. Confirm hours before visiting.</small>
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                <a className="lane-phone" href={BUSINESS.phone.href}>
                  {BUSINESS.phone.display}
                </a>
                <small>Listed phone number. Confirm directly with Lumi Lane.</small>
              </dd>
            </div>
          </dl>

          <div className="lane-visit-actions">
            <CtaLink href="/book/">Book a Table</CtaLink>
            <a href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" className={ctaClass({ variant: 'editorial' })}>
              Get directions
            </a>
          </div>
        </div>
        <figure className="lane-visit-photo">
          <div className="arch-frame">
            <ResponsivePicture
              name="storefront"
              widths={[480, 800, 1200]}
              sizes="(min-width: 900px) 42vw, 89vw"
              width={1360}
              height={972}
              alt={VISIT.storefrontAlt}
              priority
              fetchPriority="high"
            />
          </div>
          <figcaption>Fosters Road, Lightsview</figcaption>
        </figure>
      </section>

      <section className="lane-visit-details site-container" aria-label="Getting here and social media">
        <div className="lane-visit-way">
          <h2>
            Getting <em>here.</em>
          </h2>
          <p>{VISIT.gettingHere}</p>
          <a
            href={DIRECTIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={ctaClass({ variant: 'editorial', className: 'lane-text-link' })}
          >
            Open directions in Google Maps
          </a>
        </div>
        <div className="lane-visit-social">
          <h2>
            Get in <em>touch.</em>
          </h2>
          <ul>
            {BUSINESS.social.map(({ id, label, href }) => {
              // Handles are read from the published profile addresses; Facebook has none.
              const handle = id === 'instagram' ? BUSINESS.instagramHandle : href.match(/@[\w.]+/)?.[0];
              return (
                <li key={id}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
                    <span>{label.replace('Lumi Lane on ', '')}</span>
                    {handle && <span>{handle}</span>}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
