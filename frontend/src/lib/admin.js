/**
 * The review queue's API client. Separate from `api.js` because every call here
 * carries a credential, and nothing a visitor does ever reaches these paths.
 *
 * The token comes from `POST /admin/login` and is kept in sessionStorage: it
 * expires on its own, and closing the tab ends the session.
 */

import { BASE, unwrap } from "./api.js";

const STORAGE_KEY = "memorial.admin.token";

export function readToken() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // private mode, or storage disabled
  }
}

function writeToken(token) {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // A session that lives only in memory still works for this tab.
  }
}

export function signOut() {
  writeToken(null);
}

async function authed(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401) {
    const expired = new Error("unauthorized");
    expired.code = "unauthorized";
    throw expired;
  }
  if (response.status === 204) return null;
  return unwrap(response);
}

export async function signIn({ username, password }) {
  const response = await fetch(`${BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const session = await unwrap(response);
  writeToken(session.token);
  return session;
}

/** Whether a stored token is still accepted, checked once on load. */
export async function checkSession(token) {
  await authed("/admin/session", { token });
  return true;
}

export function listEntries({ token, status = "pending", limit = 50 }) {
  const query = new URLSearchParams({ status, limit: String(limit) });
  return authed(`/admin/entries?${query}`, { token });
}

export function counts(token) {
  return authed("/admin/entries/counts", { token });
}

export function publish({ token, id, note }) {
  return authed(`/admin/entries/${id}/publish`, { method: "POST", token, body: { note } });
}

export function reject({ token, id, note }) {
  return authed(`/admin/entries/${id}/reject`, { method: "POST", token, body: { note } });
}

/** Permanent: the row and both image objects, with no undo. */
export function remove({ token, id }) {
  return authed(`/admin/entries/${id}`, { method: "DELETE", token });
}

export function analyze({ token, id }) {
  return authed(`/admin/entries/${id}/analyze`, { method: "POST", token });
}

/**
 * A draft's photo. The token rides in the query string because an <img> tag
 * cannot send an Authorization header.
 */
export function reviewImageUrl({ token, id, size = "thumb" }) {
  return `${BASE}/admin/entries/${id}/${size}?token=${encodeURIComponent(token)}`;
}
