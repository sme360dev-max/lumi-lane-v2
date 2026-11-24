import { CtaLink } from '@/components/ui/Button';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import { ABOUT, VISIT } from '@/data/content';
import { StoryReveal } from './StoryReveal';

export function AboutView() {
  const [[room, kitchen], [coffee, bar]] = ABOUT.columns;
  const [neighbourhood, kitchenFact, barFact] = ABOUT.facts;

  return (
    <div className="lane-page lane-about">
      <section className="lane-about-opening site-container" aria-labelledby="story-title">
        <div className="lane-about-intro">
          <p className="lane-kicker">Coffee House &amp; Bar · Lightsview</p>
          <h1 className="lane-title" id="story-title">
            Our <em>story.</em>
          </h1>
          <p className="lane-about-deck">{ABOUT.title}</p>
          <p>{room}</p>
        </div>
        <figure className="lane-about-architecture">
          <ResponsivePicture
            name="storefront"
            widths={[480, 800, 1200]}
            sizes="(min-width: 900px) 52vw, 89vw"
            width={1360}
            height={972}
            alt={VISIT.storefrontAlt}
            priority
          />
          <figcaption>{neighbourhood?.text}</figcaption>
        </figure>
      </section>

      <section className="lane-about-coffee">
        <div className="site-container">
          <StoryReveal className="lane-coffee-photo">
            <ResponsivePicture
              name="coffee"
              widths={[480, 800]}
              sizes="(min-width: 768px) 320px, 66vw"
              width={800}
              height={800}
              alt="Lumi Lane café latte and leaf-shaped latte art"
            />
          </StoryReveal>
          <div className="lane-about-chapter">
            <p className="lane-kicker">Coffee</p>
            <h2>
              Espresso <em>from open.</em>
            </h2>
            <p>{coffee}</p>
            <CtaLink href="/menu/#coffee" variant="editorial">
              Coffee and drinks
            </CtaLink>
          </div>
        </div>
      </section>

      <section className="lane-about-kitchen site-container">
        <div className="lane-about-chapter">
          <p className="lane-kicker">The kitchen</p>
          <h2>
            All day <em>brunch.</em>
          </h2>
          <p>{kitchen}</p>
          {kitchenFact && <p className="lane-about-detail">{kitchenFact.text}</p>}
          <CtaLink href="/menu/#brunch" variant="editorial">
            {ABOUT.ctaLabel}
          </CtaLink>
        </div>
        <StoryReveal className="lane-kitchen-plate">
          <ResponsivePicture
            name="food"
            widths={[480, 800]}
            sizes="(min-width: 768px) 350px, 76vw"
            width={800}
            height={800}
            alt="Lumi Lane chilli eggs on a ceramic plate"
          />
          <blockquote>{ABOUT.quote}</blockquote>
        </StoryReveal>
      </section>

      <section className="lane-about-bar">
        <div className="site-container">
          <div>
            <p className="lane-kicker">The bar</p>
            <h2>
              By <em>afternoon.</em>
            </h2>
          </div>
          <div>
            <p>{bar}</p>
            {barFact && <p className="lane-bar-regions">{barFact.text}</p>}
            <CtaLink href="/menu/#bar" variant="editorial">
              See the bar menu
            </CtaLink>
          </div>
        </div>
      </section>

      <section className="lane-about-neighbourhood site-container">
        <div>
          <p className="lane-kicker">The neighbourhood</p>
          <h2>{neighbourhood?.title}</h2>
        </div>
        <CtaLink href="/visit/" variant="editorial">
          Visit Lumi Lane
        </CtaLink>
      </section>
    </div>
  );
}
