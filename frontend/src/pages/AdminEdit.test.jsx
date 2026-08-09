import "@testing-library/jest-dom/vitest";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { text } from "../test/render.jsx";
import { draft, opened } from "../test/reviewQueue.jsx";

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
  updateEntry: vi.fn(),
  replaceImage: vi.fn(),
  reviewImageUrl: ({ id, size = "thumb" }) => `/api/admin/entries/${id}/${size}?token=t`,
}));
const admin = await import("../lib/admin.js");

beforeEach(() => {
  vi.clearAllMocks();
});

const nameField = () => screen.getByLabelText(text("admin.edit.name"));
const saveButton = () => screen.getByRole("button", { name: text("admin.edit.save") });

describe("correcting an entry", () => {
  it("offers to save only once something has actually changed", async () => {
    const user = await opened();

    expect(screen.queryByText(text("admin.edit.unsaved"))).not.toBeInTheDocument();

    await user.type(nameField(), "s");

    expect(await screen.findByText(text("admin.edit.unsaved"))).toBeInTheDocument();
  });

  it("sends only the fields that changed", async () => {
    const user = await opened();
    admin.updateEntry.mockResolvedValue(draft({ person_name: "Some Names" }));

    await user.type(nameField(), "s");
    await user.click(saveButton());

    await waitFor(() =>
      expect(admin.updateEntry).toHaveBeenCalledWith({
        token: "token-1",
        id: "draft-1",
        patch: { person_name: "Some Names" },
      }),
    );
    // The transcription and the location were never touched, so they are not sent.
    expect(admin.replaceImage).not.toHaveBeenCalled();
  });

  it("clears the location when both coordinates are emptied", async () => {
    const user = await opened([draft({ latitude: 32.08, longitude: 34.78 })]);
    admin.updateEntry.mockResolvedValue(draft({ latitude: null, longitude: null }));

    await user.clear(screen.getByLabelText(text("admin.edit.latitude")));
    await user.clear(screen.getByLabelText(text("admin.edit.longitude")));
    await user.click(saveButton());

    await waitFor(() =>
      expect(admin.updateEntry).toHaveBeenCalledWith({
        token: "token-1",
        id: "draft-1",
        patch: { latitude: null, longitude: null },
      }),
    );
  });

  it("will not save a name that has been emptied, or a coordinate that is not one", async () => {
    const user = await opened();

    await user.clear(nameField());

    expect(await screen.findByText(text("admin.edit.bad.required"))).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await user.type(nameField(), "A Name");
    await user.type(screen.getByLabelText(text("admin.edit.latitude")), "north");

    expect(await screen.findByText(text("admin.edit.bad.coords"))).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(admin.updateEntry).not.toHaveBeenCalled();
  });

  it("holds the decision until the changes are settled", async () => {
    const user = await opened();

    await user.type(nameField(), "s");

    expect(await screen.findByText(text("admin.edit.decideAfter"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text("admin.publish") })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: text("admin.edit.discard") }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: text("admin.publish") })).toBeEnabled(),
    );
    expect(nameField()).toHaveValue("Some Name");
  });

  it("says what went wrong and keeps the changes when a save is refused", async () => {
    const user = await opened();
    admin.updateEntry.mockRejectedValue(new Error("Entry not found"));

    await user.type(nameField(), "s");
    await user.click(saveButton());

    expect(
      await screen.findByText(text("admin.edit.failed", { reason: "Entry not found" })),
    ).toBeInTheDocument();
    expect(nameField()).toHaveValue("Some Names");
  });
});
