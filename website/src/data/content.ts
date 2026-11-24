// Page copy carried over verbatim from the original prototype.

/**
 * V2 hero: the rotating tabletop. Every slide points at a REAL menu entry by id; name, price and
 * description are read from src/data/menu.ts at build time, so the hero can never drift from the menu.
 * Images are the original V1 top-down photography (public/assets/img). `note` is only used when the
 * menu entry itself has no description, and reuses V1 hero copy for that photo.
 */
export interface HeroSlide {
  menuId: string;
  image: string;
  alt: string;
  /** Title split: upright first line, italic accent second line. */
  title: readonly [string, string];
  /** Where the dish lives on the menu page (tab hash) and its section label. */
  categoryHash: 'brunch' | 'acai' | 'coffee' | 'bar';
  section: string;
  caption: string;
  note?: string;
  /** Background and accent for this stage of the hero. */
  bg: string;
  accent: string;
}

export const HERO = {
  eyebrow: 'Brewed & Baked Fresh Daily',
  srTitle: 'Lumi Lane, coffee house and bar in Lightsview, Adelaide.',
  engraving: 'LUMI LANE · COFFEE HOUSE & BAR · LIGHTSVIEW · SEVEN TILL FOUR · ',
  viewLabel: 'View on the menu',
  slides: [
    {
      menuId: 'brunch-chilli-eggs',
      image: 'food',
      alt: 'Scrambled eggs on sourdough with roasted tomatoes, seen from above',
      title: ['Chilli', 'eggs'],
      categoryHash: 'brunch',
      section: 'Brunch · All Day',
      caption: 'Eggs. Sourdough. Tomato. Chilli Jam.',
      bg: '#2b1b13',
      accent: '#f2aa91',
    },
    {
      menuId: 'brunch-dips-and-bread',
      image: 'mezze',
      alt: 'Mezze board with hummus, beetroot dip, olives and pita',
      title: ['Dips &', 'bread'],
      categoryHash: 'brunch',
      section: 'Brunch · Sides',
      caption: 'Hummus. Pita. Olives. Beetroot.',
      bg: '#2c3526',
      accent: '#dacc93',
    },
    {
      menuId: 'coffee-hot-chocolate',
      image: 'choco',
      alt: 'Hot chocolate topped with marshmallows, seen from above',
      title: ['Hot', 'chocolate'],
      categoryHash: 'coffee',
      section: 'Coffee & Drinks · Coffee',
      caption: 'Cocoa. Milk. Marshmallow. Warmth.',
      note: 'Cocoa, milk, marshmallow. Warmth in a cup.',
      bg: '#382330',
      accent: '#edacc6',
    },
    {
      menuId: 'coffee-cafe-latte',
      image: 'coffee',
      alt: 'Latte with leaf art, seen from above',
      title: ['Cafe', 'latte'],
      categoryHash: 'coffee',
      section: 'Coffee & Drinks · Coffee',
      caption: 'Espresso. Milk. Crema. Long Blacks.',
      note: 'Espresso, milk, crema. Poured from seven every morning.',
      bg: '#1e3030',
      accent: '#a8d2c4',
    },
    {
      menuId: 'brunch-bacon-and-egg',
      image: 'burger',
      alt: 'Brioche bun loaded with bacon, egg and cheese',
      title: ['Bacon', '& egg'],
      categoryHash: 'brunch',
      section: 'Brunch · B’N’B',
      caption: 'Bacon. Egg. Cheese. Brioche.',
      note: 'From the B’N’B list on our brunch menu.',
      bg: '#42271b',
      accent: '#f2bb76',
    },
  ] satisfies HeroSlide[],
} as const;

export const MENU_PAGE = {
  eyebrow: 'Our Menu',
  title: 'Brunch, coffee & everything in between.',
  intro: 'All-day favourites, coffee, bowls and evening pours.',
  ctaTitle: 'Stay a little longer.',
  ctaText: 'Found something you like?',
  ctaLabel: 'Book a Table',
};

export const MEGA = {
  eyebrow: 'Our Menu',
  title: 'Four ways to spend the day.',
  hoursLine: 'Seven till four, every day',
  fullMenuLabel: 'See the full menu',
};

export const ABOUT = {
  eyebrow: 'Our Story',
  title: 'A coffee house with a long table.',
  columns: [
    [
      'Lumi Lane is a modern Australian coffee house and bar in Lightsview, built around long brunches, good coffee and the kind of table you don\u2019t rush to leave.',
      'The kitchen cooks Australian brunch with a Middle Eastern accent: labneh under poached eggs, za\u2019atar on smashed avocado, beetroot hummus beside falafel, pomegranate over crisp cauliflower. Familiar plates, seasoned the way we grew up eating.',
    ],
    [
      'Coffee is the constant. Espresso from open, long blacks through the morning, matcha and iced everything when Adelaide turns warm.',
      'By afternoon the room shifts. South Australian wine by the glass, a short cocktail list, and small plates that carry the day into evening.',
    ],
  ] as const,
  quote: '\u201cModern Australian, seasoned Middle Eastern, open from seven.\u201d',
  facts: [
    { term: 'Since', title: 'Lightsview, SA', text: 'A neighbourhood room on Fosters Rd.' },
    { term: 'Kitchen', title: 'All-day brunch', text: 'Seven till four, every day of the week.' },
    { term: 'Bar', title: 'SA wine & cocktails', text: 'Adelaide Hills, Barossa, McLaren Vale.' },
  ],
  ctaLabel: 'See the menu',
};

export const VISIT = {
  eyebrow: 'Visit Us',
  title: 'Come for the coffee, stay for the vibe.',
  storefrontAlt: 'The Lumi Lane shopfront on Fosters Rd, sign above open glass frontage with tables inside',
  gettingHereTitle: 'Getting Here',
  gettingHere:
    'Street parking along Fosters Rd, with the Lightsview shopping precinct next door. Walk-ins welcome; larger groups are better booked ahead.',
};

export const BOOK = {
  eyebrow: 'Book a Table',
  title: 'Keep a seat for you.',
  intro: 'Join us in Lightsview for breakfast, brunch, lunch, coffee or a drink.',
  subIntro: 'Choose your preferred date and time so your details are ready when you call.',
  submitLabel: 'Request a Table',
};

export const FOOTER = {
  tagline: ['Modern Australian', 'Coffee House & Bar'],
};
