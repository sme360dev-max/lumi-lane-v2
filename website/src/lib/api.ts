export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

const TOKEN_KEY = 'lumi-lane-account-token-v1';
export const AUTH_EVENT = 'lumi-lane-account-change';

export function readAuthToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeAuthToken(token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // The user can continue for this tab even when storage is restricted.
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly errors?: Record<string, string>) {
    super(message);
  }
}

export async function accountRequest<T = unknown>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = typeof window !== 'undefined' ? readAuthToken() : null;
  if (authenticated && token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('The account service could not be reached. Please try again.', 0);
  }
  const raw: unknown = await response.json().catch(() => ({}));
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (!response.ok) {
    if (response.status === 401 && authenticated && token) writeAuthToken(null);
    const errors = data.errors && typeof data.errors === 'object' ? data.errors as Record<string, string> : undefined;
    throw new ApiError(typeof data.error === 'string' ? data.error : 'The request could not be completed.', response.status, errors);
  }
  return data as T;
}
