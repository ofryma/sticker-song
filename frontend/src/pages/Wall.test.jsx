import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, text } from "../test/render.jsx";
import Wall from "./Wall.jsx";

vi.mock("../lib/api.js", () => ({
  listEntries: vi.fn(),
  imageUrl: (entry) => `/api/entries/${entry.id}/image`,
  thumbUrl: (entry) => `/api/entries/${entry.id}/thumb`,
}));
const { listEntries } = await import("../lib/api.js");

const ENTRIES = [
  {
    id: "a",
    person_name: "First Name",
    sticker_text: "Words for the first",
    created_at: "2024-05-01T09:00:00Z",
  },
  {
    id: "b",
    person_name: "Second Name",
    sticker_text: "Words for the second",
    created_at: "2024-05-02T09:00:00Z",
  },
];

const STAGE = { name: text("wall.fullscreenTitle") };

/** jsdom has no screen to fill, so the API is stood up and watched. */
function stubFullscreen({ supported = true } = {}) {
  const calls = { enter: 0, exit: 0 };
  document.documentElement.requestFullscreen = supported
    ? vi.fn(() => {
        calls.enter += 1;
        Object.defineProperty(document, "fullscreenElement", {
          configurable: true,
          value: document.documentElement,
        });
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
      })
    : undefined;
  document.exitFullscreen = vi.fn(() => {
    calls.exit += 1;
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  });
  return calls;
}

/** Open the wall on the whole screen, from the collage. */
async function openStage(user) {
  renderApp(<Wall />);
  await user.click(await screen.findByRole("button", { name: text("wall.fullscreen") }));
  return screen.findByRole("dialog", STAGE);
}

beforeEach(() => {
  listEntries.mockReset();
  listEntries.mockResolvedValue(ENTRIES);
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
});

afterEach(() => {
  delete document.documentElement.requestFullscreen;
  delete document.exitFullscreen;
});

describe("the wall on the whole screen", () => {
  it("is offered over the collage, and not while a search is showing a list", async () => {
    stubFullscreen();
    const user = userEvent.setup();
    renderApp(<Wall />);

    const fill = await screen.findByRole("button", { name: text("wall.fullscreen") });
    expect(fill).toBeVisible();

    await user.type(screen.getByLabelText(text("wall.searchLabel")), "First");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: text("wall.fullscreen") })).toBeNull(),
    );
  });

  it("asks the browser for the screen and shows the collage on its own", async () => {
    const calls = stubFullscreen();
    const user = userEvent.setup();
    const stage = await openStage(user);

    expect(calls.enter).toBe(1);
    // Every photograph is still on the stage, and still a button to press.
    for (const entry of ENTRIES) {
      expect(screen.getAllByRole("button", { name: entry.person_name }).length).toBeGreaterThan(0);
    }
    expect(stage).toHaveAttribute("aria-modal", "true");
  });

  it("still opens a record from a photograph on the stage", async () => {
    stubFullscreen();
    const user = userEvent.setup();
    const stage = await openStage(user);

    // The stage's own photographs, not the ones on the page behind it.
    const stickers = [...stage.querySelectorAll("button")].filter(
      (node) => node.getAttribute("aria-label") === "First Name",
    );
    await user.click(stickers[0]);

    expect(await screen.findByText(text("entry.stickerText"))).toBeInTheDocument();
    // The record opens over the stage rather than instead of it.
    expect(stage).toBeInTheDocument();
  });

  it("gives the screen back on Escape", async () => {
    const calls = stubFullscreen();
    const user = userEvent.setup();
    await openStage(user);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", STAGE)).toBeNull());
    expect(calls.exit).toBe(1);
  });

  it("closes when the browser hands the screen back on its own", async () => {
    stubFullscreen();
    const user = userEvent.setup();
    await openStage(user);

    // What pressing Escape at the browser level, or F11, ends up doing.
    document.exitFullscreen();

    await waitFor(() => expect(screen.queryByRole("dialog", STAGE)).toBeNull());
  });

  it("fills the window where the browser will not give the whole screen", async () => {
    stubFullscreen({ supported: false });
    const user = userEvent.setup();
    const stage = await openStage(user);

    expect(stage).toBeVisible();
    expect(stage.className).toContain("fixed");
  });
});
