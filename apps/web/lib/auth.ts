/**
 * Unified Authentication Storage & Synchronization Helper for VoltShare
 *
 * Keeps localStorage tokens and user data consistent across Next.js
 * client-side route transitions, browser refreshes, and auth lifecycle events.
 */

export const AUTH_TOKEN_KEY = 'voltshare_token';
export const AUTH_USER_KEY = 'voltshare_user';
export const AUTH_CHANGE_EVENT = 'voltshare_auth_change';

export interface StoredAuth {
  token: string | null;
  user: any | null;
  role: 'SEEKER' | 'HOST' | 'ADMIN' | null;
}

export function getStoredAuth(): StoredAuth {
  if (typeof window === 'undefined') {
    return { token: null, user: null, role: null };
  }

  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const userStr = localStorage.getItem(AUTH_USER_KEY);
  let user: any = null;
  let role: 'SEEKER' | 'HOST' | 'ADMIN' | null = null;

  if (userStr) {
    try {
      user = JSON.parse(userStr);
      if (user?.role) role = user.role;
    } catch {}
  }

  // Fallback to JWT payload if role wasn't present in stored user object
  if (!role && token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload?.role) role = payload.role;
      }
    } catch {}
  }

  return { token, user, role };
}

export function setStoredAuth(token: string, user?: any) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(AUTH_TOKEN_KEY, token);
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }

  // Notify active components immediately (same window)
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);

  // Notify active components immediately (same window)
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}
