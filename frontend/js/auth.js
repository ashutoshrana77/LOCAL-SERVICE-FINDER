import { apiFetch, getStoredToken, setStoredToken } from './api.js';

const USER_KEY = 'lsf_auth_user';

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  setStoredToken(token);
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function clearSession() {
  setStoredToken('');
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export function dashboardUrlForRole(role) {
  if (role === 'PROVIDER') return '/provider-dashboard.html';
  if (role === 'ADMIN') return '/admin-dashboard.html';
  return '/customer-dashboard.html';
}

export async function syncSessionUser() {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const user = await apiFetch('/auth/me');
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    clearSession();
    return null;
  }
}

export async function requireRoleAccess(allowedRoles = ['CUSTOMER', 'PROVIDER', 'ADMIN']) {
  const token = getStoredToken();
  if (!token) {
    const nextUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/login.html?redirect=${nextUrl}`);
    return null;
  }

  const user = await syncSessionUser();
  if (!user) {
    const nextUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/login.html?redirect=${nextUrl}`);
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    window.location.replace(dashboardUrlForRole(user.role));
    return null;
  }

  return user;
}

export function logout(redirectTo = '/index.html') {
  clearSession();
  window.location.href = redirectTo;
}
