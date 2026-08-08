import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, text } from "../../test/render.jsx";
import { A11yButton } from "./A11yButton.jsx";

const root = () => document.documentElement;

async function openPanel() {
  const user = userEvent.setup();
  renderApp(<A11yButton />);
  await user.click(screen.getByRole("button", { name: text("a11y.open") }));
  await screen.findByRole("dialog");
  return user;
}

describe("the accessibility panel", () => {
  beforeEach(() => {
    localStorage.removeItem("memorial.a11y");
    root().removeAttribute("data-a11y-contrast");
    root().removeAttribute("data-a11y-text");
  });

  it("opens from the fixed button", async () => {
    await openPanel();
    expect(screen.getByRole("heading", { name: text("a11y.title") })).toBeInTheDocument();
  });

  it("marks a preference on the document so the whole page follows", async () => {
    const user = await openPanel();
    await user.click(screen.getByRole("switch", { name: new RegExp(text("a11y.contrast")) }));
    expect(root()).toHaveAttribute("data-a11y-contrast", "on");

    await user.click(screen.getByRole("button", { name: text("a11y.textStep.2") }));
    expect(root()).toHaveAttribute("data-a11y-text", "2");
  });

  it("keeps the choice on the device and takes it back on reset", async () => {
    const user = await openPanel();
    await user.click(screen.getByRole("switch", { name: new RegExp(text("a11y.links")) }));
    expect(JSON.parse(localStorage.getItem("memorial.a11y")).links).toBe(true);

    await user.click(screen.getByRole("button", { name: text("a11y.reset") }));
    expect(root()).not.toHaveAttribute("data-a11y-links");
    expect(root()).toHaveAttribute("data-a11y-text", "0");
  });
});
