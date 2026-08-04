import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderApp, text } from "../../test/render.jsx";
import { Thanks } from "./Thanks.jsx";

const entry = { id: "e1", person_name: "Some Name" };
const noop = vi.fn();

describe("after a submission", () => {
  it("tells the contributor their entry is waiting to be read", () => {
    renderApp(<Thanks entry={entry} awaitingReview onView={noop} onAnother={noop} />);

    expect(
      screen.getByRole("heading", { name: text("contribute.thanksPendingTitle") }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(text("contribute.thanksPendingLead", { name: "Some Name" })),
    ).toBeInTheDocument();
    expect(screen.getByText(text("contribute.thanksPendingHint"))).toBeInTheDocument();
  });

  it("says it is in the archive when review is turned off", () => {
    renderApp(<Thanks entry={entry} onView={noop} onAnother={noop} />);

    expect(
      screen.getByText(text("contribute.thanksLead", { name: "Some Name" })),
    ).toBeInTheDocument();
    expect(screen.queryByText(text("contribute.thanksPendingHint"))).not.toBeInTheDocument();
  });

  it("thanks without fanfare either way — no exclamation, no emoji", () => {
    renderApp(<Thanks entry={entry} awaitingReview onView={noop} onAnother={noop} />);

    const copy = document.body.textContent;
    expect(copy).not.toMatch(/!/);
    expect(copy).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
