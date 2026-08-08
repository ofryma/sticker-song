import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, text } from "../../test/render.jsx";
import { DuplicateReview } from "./DuplicateReview.jsx";

vi.mock("../../lib/api.js", () => ({
  voteForImage: vi.fn(),
  imageUrl: (entry) => `/api/entries/${entry.id}/image`,
}));
const { voteForImage } = await import("../../lib/api.js");

const mine = {
  id: "mine",
  person_name: "Some Name",
  image_width: 1200,
  image_height: 1600,
};
const existing = {
  id: "existing",
  person_name: "Some Name",
  image_width: 800,
  image_height: 1000,
  vote_count: 2,
  is_exact_match: true,
};
const similar = {
  id: "similar",
  person_name: "Some Namé",
  image_width: 400,
  image_height: 500,
  vote_count: 0,
  is_exact_match: false,
};

function show(props = {}) {
  return renderApp(
    <DuplicateReview
      entry={mine}
      duplicates={[existing, similar]}
      suggestedBestId="mine"
      onSkip={() => {}}
      {...props}
    />,
  );
}

/**
 * The card for one entry. Two of the three carry the same name — that is the
 * whole point of the screen — so the resolution is what tells them apart.
 */
function cardFor(entry) {
  const resolution = text("duplicates.resolution", { w: entry.image_width, h: entry.image_height });
  return screen.getByText(resolution).closest("li");
}

beforeEach(() => {
  voteForImage.mockReset();
});

describe("the comparison", () => {
  it("offers the new photograph alongside every candidate", () => {
    show();

    expect(screen.getByRole("heading", { name: text("duplicates.title") })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    // The visitor's own upload is labelled as theirs, not as an existing record.
    expect(screen.getByText(text("duplicates.yours"))).toBeInTheDocument();
    expect(screen.getAllByText(text("duplicates.existing"))).toHaveLength(2);
  });

  it("shows each candidate's match kind, and its votes only when it has some", () => {
    show();

    const card = cardFor(similar);
    expect(within(card).getByText(text("duplicates.similar"))).toBeVisible();
    // Zero votes are not worth a chip.
    expect(within(card).queryByText(/votes/)).toBeNull();

    const exact = cardFor(existing);
    expect(within(exact).getByText(text("duplicates.exact"))).toBeVisible();
    expect(within(exact).getByText(text("duplicates.votes", { n: 2 }))).toBeVisible();
  });

  it("marks the new upload as an exact match with no votes of its own", () => {
    show();

    const card = cardFor(mine);
    expect(within(card).getByText(text("duplicates.yours"))).toBeVisible();
    expect(within(card).getByText(text("duplicates.exact"))).toBeVisible();
    expect(within(card).queryByText(/votes/)).toBeNull();
  });

  it("points at the photograph the backend suggests, and only that one", () => {
    show({ suggestedBestId: existing.id });

    expect(screen.getAllByText(text("duplicates.best"))).toHaveLength(1);
    expect(within(cardFor(existing)).getByText(text("duplicates.best"))).toBeVisible();
  });
});

describe("voting", () => {
  it("records the choice and reports how far it has got", async () => {
    voteForImage.mockResolvedValue({ resolved: false, vote_count: 3, threshold: 20 });
    show();

    await userEvent.click(
      within(cardFor(similar)).getByRole("button", { name: text("duplicates.choose") }),
    );

    expect(voteForImage).toHaveBeenCalledWith("similar");
    expect(
      await screen.findByText(text("duplicates.progress", { n: 3, threshold: 20 })),
    ).toBeVisible();
    expect(within(cardFor(similar)).getByText(text("duplicates.chosen"))).toBeVisible();
  });

  it("says so when the votes were enough to merge the duplicates", async () => {
    voteForImage.mockResolvedValue({ resolved: true, vote_count: 20, threshold: 20 });
    show();

    await userEvent.click(screen.getAllByRole("button", { name: text("duplicates.choose") })[0]);

    expect(await screen.findByText(text("duplicates.resolvedTitle"))).toBeVisible();
    expect(screen.getByText(text("duplicates.resolvedLead"))).toBeVisible();
  });

  it("allows only one vote — every other card is disabled once one is chosen", async () => {
    voteForImage.mockResolvedValue({ resolved: false, vote_count: 1, threshold: 20 });
    show();

    await userEvent.click(screen.getAllByRole("button", { name: text("duplicates.choose") })[0]);

    await waitFor(() => {
      for (const button of screen.getAllByRole("button")) {
        expect(button).toBeDisabled();
      }
    });
  });

  it("explains a repeat vote rather than showing a raw error", async () => {
    const already = new Error("already-voted");
    already.code = "already-voted";
    voteForImage.mockRejectedValue(already);
    show();

    await userEvent.click(screen.getAllByRole("button", { name: text("duplicates.choose") })[0]);

    expect(await screen.findByText(text("duplicates.voted"))).toBeVisible();
    expect(screen.queryByText(text("duplicates.resolvedTitle"))).toBeNull();
  });

  it("falls back to the shared error message on any other failure", async () => {
    voteForImage.mockRejectedValue(new Error("500"));
    show();

    await userEvent.click(screen.getAllByRole("button", { name: text("duplicates.choose") })[0]);

    expect(await screen.findByText(text("common.error"))).toBeVisible();
  });
});

describe("keeping both", () => {
  it("lets the visitor decline to choose", async () => {
    const onSkip = vi.fn();
    show({ onSkip });

    await userEvent.click(screen.getByRole("button", { name: text("duplicates.skip") }));

    expect(onSkip).toHaveBeenCalled();
    expect(voteForImage).not.toHaveBeenCalled();
  });

  it("withdraws the offer to keep both once a photograph is chosen", async () => {
    voteForImage.mockResolvedValue({ resolved: false, vote_count: 1, threshold: 20 });
    show();

    await userEvent.click(screen.getAllByRole("button", { name: text("duplicates.choose") })[0]);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: text("duplicates.skip") })).toBeNull(),
    );
  });
});
