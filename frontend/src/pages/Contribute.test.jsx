import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, text } from "../test/render.jsx";
import Contribute from "./Contribute.jsx";

vi.mock("../lib/api.js", () => ({
  createEntry: vi.fn(),
  voteForImage: vi.fn(),
  imageUrl: (entry) => `/api/entries/${entry.id}/image`,
}));
const { createEntry, voteForImage } = await import("../lib/api.js");

const saved = { id: "new-1", person_name: "Some Name", sticker_text: "Words", image_url: "/x" };
const photo = () => new File(["bytes"], "sticker.jpg", { type: "image/jpeg" });

const NEXT = { name: text("contribute.next") };
const SUBMIT = { name: text("contribute.submit") };

/** Walk the wizard to the last step with a photo, a name and a transcription. */
async function fillWizard(user) {
  // The picker is behind a labelled button; the file input itself is sr-only.
  await user.upload(document.querySelector('input[type="file"]'), photo());
  await user.click(screen.getByRole("button", NEXT));

  await user.type(screen.getByLabelText(text("contribute.nameTitle")), "Some Name");
  await user.click(screen.getByRole("button", NEXT));

  await user.type(screen.getByLabelText(text("contribute.textTitle")), "Words");
  await user.click(screen.getByRole("button", NEXT));
}

beforeEach(() => {
  createEntry.mockReset();
  voteForImage.mockReset();
});

describe("the wizard", () => {
  it("opens on the photo step with no way back", () => {
    renderApp(<Contribute />);

    expect(screen.getByRole("heading", { name: text("contribute.photoTitle") })).toBeVisible();
    expect(screen.queryByRole("button", { name: text("contribute.back") })).toBeNull();
  });

  it("refuses to leave the photo step until a photograph is chosen", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await user.click(screen.getByRole("button", NEXT));

    expect(await screen.findByText(text("contribute.required.image"))).toBeVisible();
    expect(screen.getByRole("heading", { name: text("contribute.photoTitle") })).toBeVisible();
  });

  it("shows the chosen photograph, then the name and text steps", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await user.upload(document.querySelector('input[type="file"]'), photo());
    expect(screen.getByText("sticker.jpg")).toBeVisible();

    await user.click(screen.getByRole("button", NEXT));
    expect(screen.getByRole("heading", { name: text("contribute.nameTitle") })).toBeVisible();

    await user.type(screen.getByLabelText(text("contribute.nameTitle")), "Some Name");
    await user.click(screen.getByRole("button", NEXT));
    expect(screen.getByRole("heading", { name: text("contribute.textTitle") })).toBeVisible();
  });

  it("ends on a review of what is about to be kept", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await fillWizard(user);

    expect(screen.getByText(text("contribute.review"))).toBeVisible();
    expect(screen.getByText("Some Name")).toBeVisible();
    expect(screen.getByText("Words")).toBeVisible();
    expect(screen.getByRole("button", SUBMIT)).toBeVisible();
  });

  it("keeps what was typed when the visitor steps back", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await fillWizard(user);
    await user.click(screen.getByRole("button", { name: text("contribute.back") }));
    await user.click(screen.getByRole("button", { name: text("contribute.back") }));

    expect(screen.getByLabelText(text("contribute.nameTitle"))).toHaveValue("Some Name");
  });
});

describe("saving", () => {
  it("thanks the visitor by name once the entry is kept", async () => {
    createEntry.mockResolvedValue({ entry: saved });
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await fillWizard(user);
    await user.click(screen.getByRole("button", SUBMIT));

    expect(await screen.findByText(text("contribute.thanksTitle"))).toBeVisible();
    expect(
      screen.getByText(text("contribute.thanksLead", { name: "Some Name" })),
    ).toBeInTheDocument();
    // Nothing to review, so the comparison is never raised.
    expect(screen.queryByText(text("duplicates.title"))).toBeNull();
  });

  it("shows the failure and offers a retry, without losing the draft", async () => {
    createEntry.mockRejectedValue(new Error("bucket unreachable"));
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await fillWizard(user);
    await user.click(screen.getByRole("button", SUBMIT));

    expect(await screen.findByText(text("contribute.errorTitle"))).toBeVisible();
    expect(screen.getByText("bucket unreachable")).toBeVisible();
    expect(screen.getByRole("button", { name: text("contribute.errorRetry") })).toBeEnabled();
    expect(screen.getByText("Some Name")).toBeVisible();

    createEntry.mockResolvedValue({ entry: saved });
    await user.click(screen.getByRole("button", { name: text("contribute.errorRetry") }));
    expect(await screen.findByText(text("contribute.thanksTitle"))).toBeVisible();
  });

  it("hands over to the duplicate comparison when the archive may already hold the person", async () => {
    createEntry.mockResolvedValue({
      entry: saved,
      possible_duplicates: [
        { id: "old-1", person_name: "Some Name", is_exact_match: true, vote_count: 1 },
      ],
      suggested_best_id: "old-1",
    });
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await fillWizard(user);
    await user.click(screen.getByRole("button", SUBMIT));

    expect(await screen.findByText(text("duplicates.title"))).toBeVisible();
    // Two photographs to compare: the new one and the record already held.
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("drops the comparison for good once the visitor keeps both", async () => {
    createEntry.mockResolvedValue({
      entry: saved,
      possible_duplicates: [{ id: "old-1", person_name: "Some Name", is_exact_match: true }],
    });
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await fillWizard(user);
    await user.click(screen.getByRole("button", SUBMIT));
    await user.click(await screen.findByRole("button", { name: text("duplicates.skip") }));

    await waitFor(() => expect(screen.queryByText(text("duplicates.title"))).toBeNull());
    expect(screen.getByText(text("contribute.thanksTitle"))).toBeVisible();
  });

  it("starts over on request", async () => {
    createEntry.mockResolvedValue({ entry: saved });
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await fillWizard(user);
    await user.click(screen.getByRole("button", SUBMIT));
    await user.click(await screen.findByRole("button", { name: text("contribute.thanksAnother") }));

    expect(screen.getByRole("heading", { name: text("contribute.photoTitle") })).toBeVisible();
    expect(screen.queryByText("sticker.jpg")).toBeNull();
  });
});
