import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, text } from "../test/render.jsx";
import Contribute from "./Contribute.jsx";

vi.mock("../lib/api.js", () => ({
  createEntry: vi.fn(),
  voteForImage: vi.fn(),
  findNameMatches: vi.fn(),
  imageUrl: (entry) => `/api/entries/${entry.id}/image`,
  thumbUrl: (entry) => `/api/entries/${entry.id}/thumb`,
}));
const { createEntry, findNameMatches } = await import("../lib/api.js");

const NEXT = { name: text("contribute.next") };
const photo = () => new File(["bytes"], "sticker.jpg", { type: "image/jpeg" });

const existing = {
  id: "old-1",
  person_name: "Some Name",
  sticker_text: "The words already kept",
  image_width: 800,
  image_height: 1000,
  is_exact_match: true,
  vote_count: 2,
};

/** The photograph and the name — as far as the lookup can be reached. */
async function reachTheName(user, name = "Some Name") {
  await user.upload(document.querySelector('input[type="file"]'), photo());
  await user.click(screen.getByRole("button", NEXT));
  await user.type(screen.getByLabelText(text("contribute.nameTitle")), name);
}

const held = (...matches) => ({
  matches,
  has_exact_match: matches.some((match) => match.is_exact_match),
});

beforeEach(() => {
  createEntry.mockReset();
  createEntry.mockResolvedValue({ entry: { id: "new-1", person_name: "Some Name" } });
  findNameMatches.mockReset();
  findNameMatches.mockResolvedValue(held(existing));
});

describe("the name lookup", () => {
  it("says quietly, while the name is typed, that the archive already holds it", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await reachTheName(user);

    expect(
      await screen.findByText(text("nameMatch.foundOne"), {}, { timeout: 3000 }),
    ).toBeVisible();
    // Said, not imposed: the step itself is untouched and the name is still there.
    expect(screen.getByLabelText(text("contribute.nameTitle"))).toHaveValue("Some Name");
  });

  it("does not search a name too short to mean anything", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await reachTheName(user, "A");

    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(findNameMatches).not.toHaveBeenCalled();
  });

  it("stops on the decision screen instead of carrying on to the text", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await reachTheName(user);
    await user.click(screen.getByRole("button", NEXT));

    expect(
      await screen.findByRole("heading", { name: text("nameMatch.title", { name: "Some Name" }) }),
    ).toBeVisible();
    // What is already here is shown whole, words and all.
    expect(screen.getByText("The words already kept")).toBeVisible();
    expect(screen.getByText(text("duplicates.exact"))).toBeVisible();
    expect(screen.queryByRole("heading", { name: text("contribute.textTitle") })).toBeNull();
  });

  it("frames a near match as a suggestion rather than the same person", async () => {
    findNameMatches.mockResolvedValue(held({ ...existing, is_exact_match: false }));
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await reachTheName(user);
    await user.click(screen.getByRole("button", NEXT));

    expect(await screen.findByText(text("nameMatch.leadSimilar"))).toBeVisible();
    expect(screen.getByText(text("duplicates.similar"))).toBeVisible();
  });

  it("lets the visitor keep what is here and upload nothing at all", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await reachTheName(user);
    await user.click(screen.getByRole("button", NEXT));
    await user.click(await screen.findByRole("button", { name: text("nameMatch.keepAction") }));

    expect(screen.getByText(text("nameMatch.keptTitle"))).toBeVisible();
    expect(screen.getByText(text("nameMatch.keptLead", { name: "Some Name" }))).toBeInTheDocument();
    expect(createEntry).not.toHaveBeenCalled();
  });

  it("carries on with the draft as it stands when it is somebody else", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await reachTheName(user);
    await user.click(screen.getByRole("button", NEXT));
    await user.click(await screen.findByRole("button", { name: text("nameMatch.otherAction") }));

    // A near match is only a question: the photograph and the name are still here.
    expect(screen.getByRole("heading", { name: text("contribute.textTitle") })).toBeVisible();
    await user.click(screen.getByRole("button", { name: text("contribute.back") }));
    expect(screen.getByLabelText(text("contribute.nameTitle"))).toHaveValue("Some Name");
    expect(
      screen.getByRole("button", { name: new RegExp(text("contribute.photoAside")) }),
    ).toBeVisible();
  });

  it("carries on to the upload when the visitor's photograph belongs here too", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await reachTheName(user);
    await user.click(screen.getByRole("button", NEXT));
    await user.click(await screen.findByRole("button", { name: text("nameMatch.continueAction") }));

    expect(screen.getByRole("heading", { name: text("contribute.textTitle") })).toBeVisible();

    // And the same name is not asked about twice — the answer was already given.
    await user.click(screen.getByRole("button", { name: text("contribute.back") }));
    await user.click(screen.getByRole("button", NEXT));
    expect(screen.getByRole("heading", { name: text("contribute.textTitle") })).toBeVisible();
  });

  it("asks again once the name itself changes", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await reachTheName(user);
    await user.click(screen.getByRole("button", NEXT));
    await user.click(await screen.findByRole("button", { name: text("nameMatch.continueAction") }));
    await user.click(screen.getByRole("button", { name: text("contribute.back") }));

    await user.type(screen.getByLabelText(text("contribute.nameTitle")), " Junior");
    await user.click(screen.getByRole("button", NEXT));

    expect(
      await screen.findByRole("heading", {
        name: text("nameMatch.title", { name: "Some Name Junior" }),
      }),
    ).toBeVisible();
  });

  it("returns to the name for a spelling, keeping what was typed", async () => {
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await reachTheName(user);
    await user.click(screen.getByRole("button", NEXT));
    await user.click(await screen.findByRole("button", { name: text("nameMatch.editName") }));

    expect(screen.getByLabelText(text("contribute.nameTitle"))).toHaveValue("Some Name");
  });

  it("never blocks a submission because the lookup failed", async () => {
    findNameMatches.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    renderApp(<Contribute />);

    await reachTheName(user);
    await user.click(screen.getByRole("button", NEXT));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: text("contribute.textTitle") })).toBeVisible(),
    );
  });
});
