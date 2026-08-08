/**
 * Shared setup for the review page's tests, which are split across files to keep
 * each within the line limit. Each file declares its own `vi.mock` of
 * `lib/admin.js` — that factory is hoisted above imports and cannot reach in
 * here — and these helpers drive whatever it made.
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as admin from "../lib/admin.js";
import { PAGE_SIZE } from "../lib/review.js";
import Admin from "../pages/Admin.jsx";
import { renderApp, text } from "./render.jsx";

export const draft = (over = {}) => ({
  id: "draft-1",
  status: "pending",
  person_name: "Some Name",
  sticker_text: "Words from the sticker",
  latitude: null,
  longitude: null,
  image_width: 1200,
  image_height: 900,
  created_at: "2026-08-01T10:00:00Z",
  review_note: null,
  llm_verdict: null,
  llm_reason: null,
  ...over,
});

/** One page of the queue, as the backend returns it. */
export const page = (entries, over = {}) => ({
  items: entries,
  total: entries.length,
  limit: PAGE_SIZE,
  offset: 0,
  ...over,
});

/** Sign in and wait for the queue to settle. */
export async function signedIn(entries = [draft()]) {
  admin.readToken.mockReturnValue("token-1");
  admin.checkSession.mockResolvedValue(true);
  admin.listEntries.mockResolvedValue(page(entries));
  admin.counts.mockResolvedValue({ pending: entries.length, published: 4, rejected: 1 });
  const user = userEvent.setup();
  renderApp(<Admin />);
  await screen.findByRole("heading", { name: text("admin.title") });
  return user;
}

/** Sign in, then open the one draft's drawer — where every decision is made. */
export async function opened(entries = [draft()]) {
  const user = await signedIn(entries);
  await user.click(await screen.findByRole("row", { name: /Some Name/ }));
  await screen.findByRole("button", { name: text("admin.delete") });
  return user;
}
