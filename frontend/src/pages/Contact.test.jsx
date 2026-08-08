import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp, text } from "../test/render.jsx";
import Contact from "./Contact.jsx";

vi.mock("../lib/api.js", () => ({
  sendMessage: vi.fn(),
  getEntry: vi.fn(),
}));
const { sendMessage } = await import("../lib/api.js");

const SEND = { name: text("contact.send") };
const LONG_ENOUGH = "The name on this sticker is spelled wrong, it should have a yod.";

beforeEach(() => {
  sendMessage.mockReset();
  sendMessage.mockResolvedValue({ id: "m1", kind: "suggestion" });
});

/** Choose a kind and write a message long enough to be one. */
async function fillForm(user, kind = text("contact.kind.suggestion")) {
  await user.click(screen.getByRole("radio", { name: new RegExp(kind) }));
  await user.type(screen.getByPlaceholderText(text("contact.bodyPlaceholder")), LONG_ENOUGH);
}

describe("the contact form", () => {
  it("sends what was written and then thanks the visitor", async () => {
    const user = userEvent.setup();
    renderApp(<Contact />);

    await fillForm(user);
    await user.click(screen.getByRole("button", SEND));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sendMessage.mock.calls[0][0]).toMatchObject({
      kind: "suggestion",
      body: LONG_ENOUGH,
      entryId: null,
    });
    expect(await screen.findByRole("heading", { name: text("contact.thanksTitle") })).toBeVisible();
  });

  it("will not send without a kind chosen", async () => {
    const user = userEvent.setup();
    renderApp(<Contact />);

    await user.type(screen.getByPlaceholderText(text("contact.bodyPlaceholder")), LONG_ENOUGH);
    await user.click(screen.getByRole("button", SEND));

    expect(await screen.findByText(text("contact.required.kind"))).toBeVisible();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("asks for a sentence or two before sending a one-word message", async () => {
    const user = userEvent.setup();
    renderApp(<Contact />);

    await user.click(screen.getByRole("radio", { name: new RegExp(text("contact.kind.bug")) }));
    await user.type(screen.getByPlaceholderText(text("contact.bodyPlaceholder")), "broken");
    await user.click(screen.getByRole("button", SEND));

    expect(await screen.findByText(text("contact.required.body"))).toBeVisible();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("refuses an address that cannot be one, and accepts an empty field", async () => {
    const user = userEvent.setup();
    renderApp(<Contact />);

    await fillForm(user);
    const email = screen.getByPlaceholderText(text("contact.emailPlaceholder"));
    await user.type(email, "not-an-address");
    await user.click(screen.getByRole("button", SEND));

    expect(await screen.findByText(text("contact.required.email"))).toBeVisible();
    expect(sendMessage).not.toHaveBeenCalled();

    await user.clear(email);
    await user.click(screen.getByRole("button", SEND));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
  });

  it("says what went wrong and offers another try when sending fails", async () => {
    const user = userEvent.setup();
    sendMessage.mockRejectedValueOnce(new Error("Something broke on the way"));
    renderApp(<Contact />);

    await fillForm(user);
    await user.click(screen.getByRole("button", SEND));

    expect(await screen.findByText(text("contact.errorTitle"))).toBeVisible();
    expect(screen.getByText("Something broke on the way")).toBeVisible();
    expect(screen.getByRole("button", { name: text("contact.errorRetry") })).toBeVisible();
  });

  it("thanks without fanfare — no exclamation, no emoji", async () => {
    const user = userEvent.setup();
    renderApp(<Contact />);

    await fillForm(user);
    await user.click(screen.getByRole("button", SEND));
    await screen.findByRole("heading", { name: text("contact.thanksTitle") });

    const copy = document.body.textContent;
    expect(copy).not.toMatch(/!/);
    expect(copy).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
