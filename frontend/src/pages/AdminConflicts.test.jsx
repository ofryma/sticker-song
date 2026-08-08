import "@testing-library/jest-dom/vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, text } from "../test/render.jsx";
import Admin from "./Admin.jsx";

vi.mock("../lib/admin.js", () => ({
  readToken: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  checkSession: vi.fn(),
  listEntries: vi.fn(),
  counts: vi.fn(),
  publish: vi.fn(),
  reject: vi.fn(),
  remove: vi.fn(),
  analyze: vi.fn(),
  conflicts: vi.fn(),
  conflictEntries: vi.fn(),
  resolveConflict: vi.fn(),
  reviewImageUrl: ({ id, size = "thumb" }) => `/api/admin/entries/${id}/${size}?token=t`,
}));
const admin = await import("../lib/admin.js");

const group = (over = {}) => ({
  normalized_name: "dvora almog",
  person_name: "Dvora Almog",
  entry_count: 2,
  vote_count: 5,
  similar_names: [],
  latest_at: "2026-08-01T10:00:00Z",
  ...over,
});

const sticker = (over = {}) => ({
  id: "entry-1",
  status: "published",
  person_name: "Dvora Almog",
  sticker_text: "planted an olive tree",
  image_width: 800,
  image_height: 600,
  created_at: "2026-08-01T10:00:00Z",
  vote_count: 1,
  ...over,
});

const detail = (entries, over = {}) => ({
  normalized_name: "dvora almog",
  person_name: "Dvora Almog",
  entries,
  suggested_best_id: entries[0].id,
  ...over,
});

/** Sign in and switch to the conflicts tab. */
async function onConflicts(groups = [group()]) {
  admin.readToken.mockReturnValue("token-1");
  admin.checkSession.mockResolvedValue(true);
  admin.listEntries.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
  admin.counts.mockResolvedValue({ pending: 0, published: 0, rejected: 0 });
  admin.conflicts.mockResolvedValue({ items: groups, total: groups.length, limit: 25, offset: 0 });
  const user = userEvent.setup();
  renderApp(<Admin />);
  await user.click(await screen.findByRole("tab", { name: text("admin.mode.conflicts") }));
  return user;
}

/** Open the one conflict's drawer. */
async function openConflict(entries) {
  admin.conflictEntries.mockResolvedValue(detail(entries));
  const user = await onConflicts();
  await user.click(await screen.findByRole("row", { name: /Dvora Almog/ }));
  await screen.findByRole("button", { name: text("admin.conflicts.kept") });
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  admin.readToken.mockReturnValue(null);
});

describe("the conflicts tab", () => {
  it("lists a person once, with how many stickers and votes they carry", async () => {
    await onConflicts();

    expect(await screen.findByText("Dvora Almog")).toBeInTheDocument();
    expect(screen.getByText(text("admin.conflicts.stickers", { n: 2 }))).toBeInTheDocument();
    expect(screen.getByText(text("admin.conflicts.votes", { n: 5 }))).toBeInTheDocument();
  });

  it("shows names that only look alike beside the group, not inside it", async () => {
    await onConflicts([group({ similar_names: ["dvora almogi"] })]);

    expect(await screen.findByText("dvora almogi")).toBeInTheDocument();
    // Still two stickers: a near-match was not folded in.
    expect(screen.getByText(text("admin.conflicts.stickers", { n: 2 }))).toBeInTheDocument();
  });

  it("says so plainly when nobody is held twice", async () => {
    await onConflicts([]);

    expect(await screen.findByText(text("admin.conflicts.empty"))).toBeInTheDocument();
  });

  it("leaves the photographs unfetched until a person is opened", async () => {
    admin.conflictEntries.mockResolvedValue(detail([sticker(), sticker({ id: "entry-2" })]));
    const user = await onConflicts();

    expect(admin.conflictEntries).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("row", { name: /Dvora Almog/ }));

    await waitFor(() =>
      expect(admin.conflictEntries).toHaveBeenCalledWith(
        expect.objectContaining({ name: "dvora almog" }),
      ),
    );
    expect(await screen.findAllByAltText(/Dvora Almog/)).toHaveLength(2);
  });
});

describe("resolving a conflict", () => {
  it("starts on the suggestion and keeps it when the reviewer agrees", async () => {
    const user = await openConflict([
      sticker({ id: "big", image_width: 2000, image_height: 1500 }),
      sticker({ id: "small" }),
    ]);
    admin.resolveConflict.mockResolvedValue({ winner_id: "big", deleted_entry_ids: ["small"] });

    await user.click(
      screen.getByRole("button", { name: text("admin.conflicts.resolve", { n: 1 }) }),
    );
    await user.click(screen.getByRole("button", { name: text("admin.conflicts.confirm") }));

    await waitFor(() =>
      expect(admin.resolveConflict).toHaveBeenCalledWith(
        expect.objectContaining({ winnerId: "big", loserIds: ["small"] }),
      ),
    );
  });

  it("keeps the one the reviewer picks over the suggestion", async () => {
    const user = await openConflict([sticker({ id: "suggested" }), sticker({ id: "chosen" })]);
    admin.resolveConflict.mockResolvedValue({
      winner_id: "chosen",
      deleted_entry_ids: ["suggested"],
    });

    const cards = screen.getAllByRole("article");
    await user.click(within(cards[1]).getByRole("button", { name: text("admin.conflicts.keep") }));
    await user.click(
      screen.getByRole("button", { name: text("admin.conflicts.resolve", { n: 1 }) }),
    );
    await user.click(screen.getByRole("button", { name: text("admin.conflicts.confirm") }));

    await waitFor(() =>
      expect(admin.resolveConflict).toHaveBeenCalledWith(
        expect.objectContaining({ winnerId: "chosen", loserIds: ["suggested"] }),
      ),
    );
  });

  it("warns before the second step, and backs out without deleting anything", async () => {
    const user = await openConflict([sticker({ id: "a" }), sticker({ id: "b" })]);

    await user.click(
      screen.getByRole("button", { name: text("admin.conflicts.resolve", { n: 1 }) }),
    );
    expect(screen.getByText(text("admin.conflicts.warning"))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: text("admin.conflicts.cancel") }));

    expect(screen.queryByText(text("admin.conflicts.warning"))).not.toBeInTheDocument();
    expect(admin.resolveConflict).not.toHaveBeenCalled();
  });

  it("closes the drawer and re-reads the list once it is settled", async () => {
    const user = await openConflict([sticker({ id: "a" }), sticker({ id: "b" })]);
    admin.resolveConflict.mockResolvedValue({ winner_id: "a", deleted_entry_ids: ["b"] });
    admin.conflicts.mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 });

    await user.click(
      screen.getByRole("button", { name: text("admin.conflicts.resolve", { n: 1 }) }),
    );
    await user.click(screen.getByRole("button", { name: text("admin.conflicts.confirm") }));

    expect(await screen.findByText(text("admin.conflicts.empty"))).toBeInTheDocument();
  });
});
