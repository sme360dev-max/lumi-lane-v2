export interface NavItem {
  href: string;
  label: string;
}

/** Primary destinations in the original order. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/about/', label: 'About' },
  { href: '/menu/', label: 'Menu' },
  { href: '/visit/', label: 'Visit Us' },
  { href: '/book/', label: 'Book a Table' },
];

export const HEADER_NAV: NavItem[] = [...PRIMARY_NAV, { href: '/loyalty/', label: 'Loyalty' }];

export const ACCOUNT_NAV = [
  { href: '/login/', label: 'Log In' },
  { href: '/signup/', label: 'Sign Up' },
] as const;

/** Menu overview links and the category tab each one opens. */
export const MEGA_COLUMNS = [
  { lines: ['Brunch', '& All Day'], tab: 'brunch' },
  { lines: ['Açaí', 'Bowls'], tab: 'acai' },
  { lines: ['Coffee', '& Drinks'], tab: 'coffee' },
  { lines: ['Bar', '& Sweets'], tab: 'bar' },
] as const;
