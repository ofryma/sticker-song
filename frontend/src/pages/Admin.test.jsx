import "@testing-library/jest-dom/vitest";
import { screen, waitFor } from "@testing-library/react";
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
  reviewImageUrl: ({ id, size = "thumb" }) => `/api/admin/entries/${id}/${size}?token=t`,
}));
const admin = await import("../lib/admin.js");

const draft = (over = {}) => ({
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

/** Sign in and wait for the queue to settle. */
async function signedIn(entries = [draft()]) {
  admin.readToken.mockReturnValue("token-1");
  admin.checkSession.mockResolvedValue(true);
  admin.listEntries.mockResolvedValue(entries);
  admin.counts.mockResolvedValue({
    pending: entries.length,
    published: 4,
    rejected: 1,
  });
  const user = userEvent.setup();
  renderApp(<Admin />);
  await screen.findByRole("heading", { name: text("admin.title") });
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  admin.readToken.mockReturnValue(null);
});

describe("signing in", () => {
  it("asks for credentials when there is no stored token", async () => {
    renderApp(<Admin />);

    expect(
      await screen.findByRole("heading", { name: text("admin.signInTitle") }),
    ).toBeInTheDocument();
    expect(admin.listEntries).not.toHaveBeenCalled();
  });

  it("shows the queue once the credentials are accepted", async () => {
    const user = userEvent.setup();
    admin.signIn.mockResolvedValue({ token: "token-1" });
    admin.listEntries.mockResolvedValue([draft()]);
    admin.counts.mockResolvedValue({ pending: 1, published: 0, rejected: 0 });
    renderApp(<Admin />);

    await user.type(screen.getByLabelText(text("admin.username")), "reviewer");
    await user.type(screen.getByLabelText(text("admin.password")), "secret");
    await user.click(screen.getByRole("button", { name: text("admin.signIn") }));

    expect(await screen.findByText("Some Name")).toBeInTheDocument();
    expect(admin.signIn).toHaveBeenCalledWith({
      username: "reviewer",
      password: "secret",
    });
  });

  it("says so plainly when the password is wrong", async () => {
    const user = userEvent.setup();
    admin.signIn.mockRejectedValue(new Error("Incorrect username or password"));
    renderApp(<Admin />);

    await user.type(screen.getByLabelText(text("admin.username")), "reviewer");
    await user.type(screen.getByLabelText(text("admin.password")), "wrong");
    await user.click(screen.getByRole("button", { name: text("admin.signIn") }));

    expect(await screen.findByText(text("admin.signInFailed"))).toBeInTheDocument();
  });

  it("falls back to the form when a stored token has expired", async () => {
    admin.readToken.mockReturnValue("stale");
    admin.checkSession.mockRejectedValue(new Error("unauthorized"));

    renderApp(<Admin />);

    expect(
      await screen.findByRole("heading", { name: text("admin.signInTitle") }),
    ).toBeInTheDocument();
  });
});

describe("the queue", () => {
  it("shows each draft whole: photograph, name and transcription", async () => {
    await signedIn();

    expect(screen.getByText("Some Name")).toBeInTheDocument();
    expect(screen.getByText("Words from the sticker")).toBeInTheDocument();
    const photo = screen.getByAltText(text("entry.photo", { name: "Some Name" }));
    expect(photo).toHaveAttribute("src", expect.stringContaining("/thumb"));
  });

  it("counts what sits in each state", async () => {
    await signedIn();

    const waiting = screen.getByRole("tab", {
      name: new RegExp(text("admin.status.pending")),
    });
    expect(waiting).toHaveTextContent("1");
    expect(
      screen.getByRole("tab", { name: new RegExp(text("admin.status.published")) }),
    ).toHaveTextContent("4");
  });

  it("says the queue is clear when nothing is waiting", async () => {
    await signedIn([]);

    expect(screen.getByText(text("admin.empty.pending"))).toBeInTheDocument();
  });

  it("asks for a different slice when a tab is chosen", async () => {
    const user = await signedIn();

    await user.click(screen.getByRole("tab", { name: new RegExp(text("admin.status.rejected")) }));

    await waitFor(() =>
      expect(admin.listEntries).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "rejected" }),
      ),
    );
  });
});

describe("deciding", () => {
  it("publishes with the reviewer's note and drops the entry from the queue", async () => {
    const user = await signedIn();
    admin.publish.mockResolvedValue({});
    admin.counts.mockResolvedValue({ pending: 0, published: 5, rejected: 1 });

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

  it("holds an entry back without deleting it", async () => {
    const user = await signedIn();
    admin.reject.mockResolvedValue({});

    await user.click(screen.getByRole("button", { name: text("admin.reject") }));

    await waitFor(() => expect(admin.reject).toHaveBeenCalled());
    expect(admin.remove).not.toHaveBeenCalled();
  });

  it("takes two steps to delete, and warns before the second", async () => {
    const user = await signedIn();
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
    const user = await signedIn();

    await user.click(screen.getByRole("button", { name: text("admin.delete") }));
    await user.click(screen.getByRole("button", { name: text("admin.cancel") }));

    expect(screen.queryByText(text("admin.deleteWarning"))).not.toBeInTheDocument();
    expect(admin.remove).not.toHaveBeenCalled();
  });

  it("returns to the sign-in form when the token dies mid-session", async () => {
    const user = await signedIn();
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
    const user = await signedIn();
    admin.analyze.mockResolvedValue(draft({ llm_verdict: "ok", llm_reason: "reads fine" }));

    expect(screen.getByText(text("admin.llm.none"))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: text("admin.llm.run") }));

    expect(await screen.findByText("reads fine")).toBeInTheDocument();
  });

  it("shows a flag as something to look at, next to the buttons and not instead", async () => {
    await signedIn([draft({ llm_verdict: "flag", llm_reason: "looks like a placeholder" })]);

    expect(screen.getByText(text("admin.llm.flag"))).toBeInTheDocument();
    expect(screen.getByText("looks like a placeholder")).toBeInTheDocument();
    expect(screen.getByText(text("admin.llm.advisory"))).toBeInTheDocument();
    // The decision stays the reviewer's: both actions are still offered.
    expect(screen.getByRole("button", { name: text("admin.publish") })).toBeEnabled();
    expect(screen.getByRole("button", { name: text("admin.reject") })).toBeEnabled();
  });
});
