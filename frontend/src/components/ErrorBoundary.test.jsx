import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, text } from "../test/render.jsx";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

function Boom({ explode }) {
  if (explode) throw new Error("render failed");
  return <p>the page</p>;
}

// React logs the caught error itself; the test does not need the noise.
beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("ErrorBoundary", () => {
  it("shows the fallback instead of a blank page when a child throws", () => {
    renderApp(
      <ErrorBoundary>
        <Boom explode />
      </ErrorBoundary>,
    );

    expect(screen.getByText(text("common.crashed"))).toBeInTheDocument();
  });

  it("renders its children again after retry", async () => {
    const user = userEvent.setup();
    const { rerender } = renderApp(
      <ErrorBoundary>
        <Boom explode />
      </ErrorBoundary>,
    );

    rerender(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole("button", { name: text("common.retry") }));

    expect(screen.getByText("the page")).toBeInTheDocument();
  });

  it("clears itself when the reset key changes", () => {
    const { rerender } = renderApp(
      <ErrorBoundary resetKey="/wall">
        <Boom explode />
      </ErrorBoundary>,
    );
    expect(screen.getByText(text("common.crashed"))).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="/about">
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText("the page")).toBeInTheDocument();
  });
});
