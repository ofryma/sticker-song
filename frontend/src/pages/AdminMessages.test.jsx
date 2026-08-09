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
  messages: vi.fn(),
  messageCounts: vi.fn(),
  decideMessage: vi.fn(),
  reviewImageUrl: ({ id, size = "thumb" }) => `/api/admin/entries/${id}/${size}?token=t`,
}));
const admin = await import("../lib/admin.js");

const message = (over = {}) => ({
  id: "msg-1",
  kind: "entry_problem",
  body: "The name on this sticker is spelled wrong, it should have a yod.",
  status: "open",
  entry_id: "entry-1",
  entry_person_name: "Dvora Almog",
  has_reply_email: true,
  resolved_by: null,
  resolved_at: null,
  created_at: "2026-08-01T10:00:00Z",
  ...over,
});

/** Sign in and switch to the messages tab. */
async function onMessages(items = [message()]) {
  admin.readToken.mockReturnValue("token-1");
  admin.checkSession.mockResolvedValue(true);
  admin.listEntries.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
  admin.counts.mockResolvedValue({ pending: 0, published: 0, rejected: 0 });
  admin.messages.mockResolvedValue({ items, total: items.length, limit: 25, offset: 0 });
  admin.messageCounts.mockResolvedValue({ open: items.length, resolved: 0, dismissed: 0 });
  const user = userEvent.setup();
  renderApp(<Admin />);
  await user.click(await screen.findByRole("tab", { name: text("admin.mode.messages") }));
  return user;
}

/* The row's accessible name is built from its first cell alone, so rows are
   found by the text on them and walked up to. */
async function rowSaying(pattern) {
  return (await screen.findByText(pattern)).closest("tr");
}

beforeEach(() => {
  vi.clearAllMocks();
  admin.readToken.mockReturnValue(null);
});

describe("the messages tab", () => {
  it("opens on what is still waiting", async () => {
    await onMessages();

    await waitFor(() => expect(admin.messages).toHaveBeenCalled());
    expect(admin.messages.mock.calls[0][0]).toMatchObject({ status: "open", kind: "all" });
  });

  it("lists a message with what it is about and the sticker it names", async () => {
    await onMessages();

    const row = await rowSaying(/spelled wrong/);
    expect(within(row).getByText(text("admin.messages.kind.entry_problem"))).toBeInTheDocument();
    expect(within(row).getByText("Dvora Almog")).toBeInTheDocument();
  });

  it("opens the message in the drawer and says a reply is possible", async () => {
    const user = await onMessages();

    await user.click(await rowSaying(/spelled wrong/));

    expect(await screen.findByText(text("admin.messages.canReply"))).toBeInTheDocument();
    // Mid-animation the drawer is still fading in, so presence is the assertion.
    expect(
      screen.getByRole("button", { name: text("admin.messages.resolve") }),
    ).toBeInTheDocument();
  });

  it("says so plainly when the sticker a message named is gone", async () => {
    const user = await onMessages([message({ entry_person_name: null })]);

    await user.click(await rowSaying(/spelled wrong/));

    expect(await screen.findByText(text("admin.messages.aboutGone"))).toBeInTheDocument();
  });

  it("marks one dealt with, and reloads so it leaves the open view", async () => {
    admin.decideMessage.mockResolvedValue(message({ status: "resolved" }));
    const user = await onMessages();

    await user.click(await rowSaying(/spelled wrong/));
    await user.click(screen.getByRole("button", { name: text("admin.messages.resolve") }));

    await waitFor(() =>
      expect(admin.decideMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: "msg-1", action: "resolve" }),
      ),
    );
  });

  it("carries on to the next message once one is decided", async () => {
    admin.decideMessage.mockResolvedValue(message({ status: "dismissed" }));
    const user = await onMessages([
      message(),
      message({ id: "msg-2", body: "The photo is sideways.", entry_person_name: "Yonatan Bar" }),
    ]);

    await user.click(await rowSaying(/spelled wrong/));
    await user.click(screen.getByRole("button", { name: text("admin.messages.dismiss") }));

    expect(await screen.findByText(text("admin.messages.about"))).toBeInTheDocument();
    // The drawer shows the second message now, without going back to the list.
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText(/photo is sideways/)).toBeInTheDocument();
  });

  it("closes once the last message on the page is decided", async () => {
    admin.decideMessage.mockResolvedValue(message({ status: "resolved" }));
    const user = await onMessages();

    await user.click(await rowSaying(/spelled wrong/));
    await user.click(screen.getByRole("button", { name: text("admin.messages.resolve") }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("narrows to one kind, and starts again at the first page", async () => {
    const user = await onMessages();
    await screen.findByText(/spelled wrong/);

    await user.click(
      screen.getByRole("button", { name: new RegExp(text("admin.messages.filterKind")) }),
    );
    await user.click(await screen.findByRole("option", { name: text("admin.messages.kind.bug") }));

    await waitFor(() =>
      expect(admin.messages).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: "bug", offset: 0 }),
      ),
    );
  });

  it("distinguishes nothing having arrived from nothing matching the filters", async () => {
    const user = await onMessages([]);

    expect(await screen.findByText(text("admin.messages.empty"))).toBeInTheDocument();

    // The same empty page under a narrower filter means something else.
    await user.click(
      screen.getByRole("button", { name: new RegExp(text("admin.messages.filterKind")) }),
    );
    await user.click(await screen.findByRole("option", { name: text("admin.messages.kind.bug") }));

    expect(await screen.findByText(text("admin.messages.noResults"))).toBeInTheDocument();
  });
});
