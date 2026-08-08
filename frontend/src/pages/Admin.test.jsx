import "@testing-library/jest-dom/vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, text } from "../test/render.jsx";
import { draft, opened, page, signedIn } from "../test/reviewQueue.jsx";
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
    admin.listEntries.mockResolvedValue(page([draft()]));
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
  it("lists a row per draft: the name and what the sticker says", async () => {
    await signedIn();

    expect(screen.getByText("Some Name")).toBeInTheDocument();
    expect(screen.getByText("Words from the sticker")).toBeInTheDocument();
  });

  it("leaves the photograph unfetched until a row is opened", async () => {
    const user = await signedIn();

    const alt = text("entry.photo", { name: "Some Name" });
    expect(screen.queryByAltText(alt)).not.toBeInTheDocument();

    await user.click(screen.getByRole("row", { name: /Some Name/ }));

    const photo = await screen.findByAltText(alt);
    expect(photo).toHaveAttribute("src", expect.stringContaining("/thumb"));
  });

  it("closes the drawer once the entry leaves the queue", async () => {
    const user = await opened();
    admin.publish.mockResolvedValue({});
    admin.counts.mockResolvedValue({ pending: 0, published: 5, rejected: 1 });
    admin.listEntries.mockResolvedValue(page([]));

    await user.click(screen.getByRole("button", { name: text("admin.publish") }));

    await waitFor(() =>
      expect(
        screen.queryByAltText(text("entry.photo", { name: "Some Name" })),
      ).not.toBeInTheDocument(),
    );
  });

  it("asks the backend to search, once the typing settles", async () => {
    const user = await signedIn();

    await user.type(screen.getByLabelText(text("admin.searchLabel")), "dvora");

    await waitFor(() =>
      expect(admin.listEntries).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: expect.objectContaining({ query: "dvora" }) }),
      ),
    );
    // Debounced: five keystrokes are not five requests.
    expect(admin.listEntries.mock.calls.length).toBeLessThan(5);
  });

  it("says nothing matched when a filter empties the page", async () => {
    const user = await signedIn();
    admin.listEntries.mockResolvedValue(page([]));

    await user.type(screen.getByLabelText(text("admin.searchLabel")), "nobody");

    expect(await screen.findByText(text("admin.noResults"))).toBeInTheDocument();
  });

  it("asks for the ordering the reviewer clicks, and lets the database do it", async () => {
    const user = await signedIn();

    await user.click(screen.getByRole("columnheader", { name: text("admin.col.name") }));

    await waitFor(() =>
      expect(admin.listEntries).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: { column: "name", direction: expect.any(String) } }),
      ),
    );
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
