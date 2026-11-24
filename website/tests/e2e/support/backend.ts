import type { Page, Request } from '@playwright/test';

/** Where the static site expects the venue API (see src/lib/api.ts). The e2e suite never starts it. */
export const API_ORIGIN = 'http://127.0.0.1:8000';

/** The programme the loyalty page falls back to (src/features/loyalty/program.ts). */
export const LOYALTY_PROGRAM = { active: true, pointsPerOrder: 1, pointsForReward: 8, rewardCents: 2000 };

export interface MockResponse {
  status?: number;
  body?: unknown;
}

export type MockHandler = MockResponse | ((request: Request) => MockResponse | Promise<MockResponse>);

/** Keyed by "METHOD /api/path/", e.g. "POST /api/bookings/". */
export type MockHandlers = Record<string, MockHandler>;

const DEFAULTS: MockHandlers = {
  // An empty payload keeps the menu bundled with the site (src/features/menu/menu-data.ts).
  'GET /api/menu/': { body: {} },
  'GET /api/loyalty/': { body: LOYALTY_PROGRAM },
};

/**
 * Answers the site's API calls inside the browser, so pages can be exercised without the Django
 * service. Routes that a test does not describe answer 404, exactly as an unknown endpoint would.
 * Returns the list of requests seen, for assertions about what was (or was not) sent.
 */
export async function mockBackend(page: Page, handlers: MockHandlers = {}) {
  const seen: { method: string; path: string; body: unknown }[] = [];
  await page.route(`${API_ORIGIN}/api/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const key = `${request.method()} ${path}`;
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    seen.push({ method: request.method(), path, body });
    const handler = handlers[key] ?? DEFAULTS[key] ?? { status: 404, body: { error: 'Not found.' } };
    const response = typeof handler === 'function' ? await handler(request) : handler;
    await route.fulfill({
      status: response.status ?? 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      body: JSON.stringify(response.body ?? {}),
    });
  });
  return seen;
}
