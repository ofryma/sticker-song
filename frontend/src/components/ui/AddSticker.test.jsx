import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderApp, text } from "../../test/render.jsx";
import { AddSticker } from "./AddSticker.jsx";
import { Hero } from "../Hero.jsx";
import { EmptyWall } from "../States.jsx";

// HeroUI gives its buttons role="button" even when they are router links.
const NAME = { name: text("nav.contribute") };

describe("the add-a-sticker call to action", () => {
  it("leads to the contribute page, marked with the leaf", () => {
    renderApp(<AddSticker />);
    const cta = screen.getByRole("button", NAME);
    expect(cta).toHaveAttribute("href", "/contribute");
    // The mark travels with it, and is decorative to a screen reader.
    expect(cta.querySelector("svg")).toBeInTheDocument();
    expect(cta.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("says the same thing wherever it stands", () => {
    renderApp(
      <>
        <Hero count={null} />
        <EmptyWall />
      </>,
    );
    const ctas = screen.getAllByRole("button", NAME);
    expect(ctas).toHaveLength(2);
    for (const cta of ctas) expect(cta).toHaveAttribute("href", "/contribute");
  });

  it("is the only solid button in the hero; the wall is the quiet one", () => {
    renderApp(<Hero count={null} />);
    expect(screen.getByRole("button", NAME)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text("home.cta") })).toHaveAttribute("href", "/wall");
  });
});
