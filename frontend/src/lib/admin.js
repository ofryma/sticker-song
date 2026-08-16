/**
 * The review queue's API client. Separate from `api.js` because every call here
 * carries a credential, and nothing a visitor does ever reaches these paths.
 *
 * The token comes from `POST /admin/login` and is kept in sessionStorage: it
 * expires on its own, and closing the tab ends the session.
 */

import { BASE, unwrap } from "./api.js";
import { queryFor } from "./review.js";

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

async function authed(path, { method = "GET", token, body, form } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      // A FormData body sets its own content type, boundary and all.
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: form ?? (body ? JSON.stringify(body) : undefined),
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

/**
 * One page of the queue: `{ items, total, limit, offset }`. Every filter and the
 * sort are the database's work — see `queryFor` for what is sent.
 */
export function listEntries({ token, ...request }) {
  const query = new URLSearchParams(
    Object.entries(queryFor(request)).map(([key, value]) => [key, String(value)]),
  );
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

/**
 * Correct what an entry says. `patch` carries only the fields that changed —
 * the backend writes exactly the keys it is sent, so an absent one is left
 * alone and an explicit `null` clears it. Returns the entry as it now stands.
 */
export function updateEntry({ token, id, patch }) {
  return authed(`/admin/entries/${id}`, { method: "PATCH", token, body: patch });
}

/** Put a different photograph on an entry; the one it replaces is destroyed. */
export function replaceImage({ token, id, file }) {
  const form = new FormData();
  form.append("image", file);
  return authed(`/admin/entries/${id}/image`, { method: "PUT", token, form });
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
 *
 * `version` is whatever changes when the entry does — the photograph on an entry
 * can be replaced, and the response is cached as though it never could be.
 */
export function reviewImageUrl({ token, id, size = "thumb", version }) {
  const stamp = version ? `&v=${encodeURIComponent(version)}` : "";
  return `${BASE}/admin/entries/${id}/${size}?token=${encodeURIComponent(token)}${stamp}`;
}

/** One page of what visitors wrote: `{ items, total, limit, offset }`. */
export function messages({
  token,
  status = "open",
  kind = "all",
  query = "",
  limit = 25,
  offset = 0,
}) {
  const params = new URLSearchParams({
    status,
    kind,
    limit: String(limit),
    offset: String(offset),
  });
  if (query.trim()) params.set("q", query.trim());
  return authed(`/admin/messages?${params}`, { token });
}

export function messageCounts(token) {
  return authed("/admin/messages/counts", { token });
}

/** `action` is "resolve" or "dismiss". Idempotent, so a second press is harmless. */
export function decideMessage({ token, id, action }) {
  return authed(`/admin/messages/${id}/${action}`, { method: "POST", token });
}

/** People the archive holds more than one sticker for: `{ items, total, ... }`. */
export function conflicts({ token, query = "", limit = 25, offset = 0 }) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (query.trim()) params.set("q", query.trim());
  return authed(`/admin/conflicts?${params}`, { token });
}

/** Every sticker held under one normalized name, with each one's votes. */
export function conflictEntries({ token, name }) {
  return authed(`/admin/conflicts/entries?name=${encodeURIComponent(name)}`, { token });
}

/**
 * Keep one sticker and destroy the others. Permanent: rows and photographs
 * alike. The losers are named explicitly, so nothing outside what the reviewer
 * was looking at can be deleted.
 */
export function resolveConflict({ token, winnerId, loserIds }) {
  return authed("/admin/conflicts/resolve", {
    method: "POST",
    token,
    body: { winner_id: winnerId, loser_ids: loserIds },
  });
}

/**
 * When the archive was last copied to the drive, and what those copies hold.
 * Read-only, and reading files rather than a table: the API reports on the
 * backups and has no way to start one or delete one. See ops/backup.sh.
 */
export function backups(token) {
  return authed("/admin/backups", { token });
}
