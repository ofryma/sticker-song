import "@testing-library/jest-dom/vitest";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { text } from "../test/render.jsx";
import { draft, opened, page } from "../test/reviewQueue.jsx";

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
  reviewImageUrl: ({ id, size = "thumb" }) => `/api/admin/entries/${id}/${size}?token=t`,
}));
const admin = await import("../lib/admin.js");

beforeEach(() => {
  vi.clearAllMocks();
  admin.readToken.mockReturnValue(null);
});

describe("deciding", () => {
  it("publishes with the reviewer's note and drops the entry from the queue", async () => {
    const user = await opened();
    admin.publish.mockResolvedValue({});
    admin.counts.mockResolvedValue({ pending: 0, published: 5, rejected: 1 });
    // The decision refetches the page; the published entry is no longer in it.
    admin.listEntries.mockResolvedValue(page([]));

    await user.type(screen.getByLabelText(text("admin.noteLabel")), "checked the spelling");
    await user.click(screen.getByRole("button", { name: text("admin.publish") }));

    await waitFor(() =>
      expect(admin.publish).toHaveBeenCalledWith({
        token: "token-1",
        id: "draft-1",
        note: "checked the spelling",
      }),
    );
    expect(await screen.findByText(text("admin.empty.pending"))).toBeInTheDocument();
  });

  it("moves on to the next submission so a run of decisions needs no return trip", async () => {
    const user = await opened([
      draft(),
      draft({ id: "draft-2", person_name: "Another Name", sticker_text: "different words" }),
    ]);
    admin.publish.mockResolvedValue({});

    await user.click(screen.getByRole("button", { name: text("admin.publish") }));

    expect(
      await screen.findByAltText(text("entry.photo", { name: "Another Name" })),
    ).toBeInTheDocument();
    // The note belongs to the decision that is made, not the one before it.
    expect(screen.getByLabelText(text("admin.noteLabel"))).toHaveValue("");
  });

  it("holds an entry back without deleting it", async () => {
    const user = await opened();
    admin.reject.mockResolvedValue({});

    await user.click(screen.getByRole("button", { name: text("admin.reject") }));

    await waitFor(() => expect(admin.reject).toHaveBeenCalled());
    expect(admin.remove).not.toHaveBeenCalled();
  });

  it("takes two steps to delete, and warns before the second", async () => {
    const user = await opened();
    admin.remove.mockResolvedValue(null);

    await user.click(screen.getByRole("button", { name: text("admin.delete") }));

    expect(screen.getByText(text("admin.deleteWarning"))).toBeInTheDocument();
    expect(admin.remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: text("admin.deleteConfirm") }));

    await waitFor(() =>
      expect(admin.remove).toHaveBeenCalledWith({ token: "token-1", id: "draft-1" }),
    );
  });

  it("lets the reviewer back out of a deletion", async () => {
    const user = await opened();

    await user.click(screen.getByRole("button", { name: text("admin.delete") }));
    await user.click(screen.getByRole("button", { name: text("admin.cancel") }));

    expect(screen.queryByText(text("admin.deleteWarning"))).not.toBeInTheDocument();
    expect(admin.remove).not.toHaveBeenCalled();
  });

  it("returns to the sign-in form when the token dies mid-session", async () => {
    const user = await opened();
    const expired = new Error("unauthorized");
    expired.code = "unauthorized";
    admin.publish.mockRejectedValue(expired);

    await user.click(screen.getByRole("button", { name: text("admin.publish") }));

    expect(
      await screen.findByRole("heading", { name: text("admin.signInTitle") }),
    ).toBeInTheDocument();
  });
});

describe("the LLM note", () => {
  it("offers a read when none has been made", async () => {
    const user = await opened();
    admin.analyze.mockResolvedValue(draft({ llm_verdict: "ok", llm_reason: "reads fine" }));

    expect(screen.getByText(text("admin.llm.none"))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: text("admin.llm.run") }));

    expect(await screen.findByText("reads fine")).toBeInTheDocument();
  });

  it("shows a flag as something to look at, next to the buttons and not instead", async () => {
    await opened([draft({ llm_verdict: "flag", llm_reason: "looks like a placeholder" })]);

    // Once in the row's read column, once beside the decision in the drawer.
    expect(screen.getAllByText(text("admin.llm.flag"))).toHaveLength(2);
    expect(screen.getByText("looks like a placeholder")).toBeInTheDocument();
    expect(screen.getByText(text("admin.llm.advisory"))).toBeInTheDocument();
    // The decision stays the reviewer's: both actions are still offered.
    expect(screen.getByRole("button", { name: text("admin.publish") })).toBeEnabled();
    expect(screen.getByRole("button", { name: text("admin.reject") })).toBeEnabled();
  });
});
