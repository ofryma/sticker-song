import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, text } from "../../test/render.jsx";
import { stubCanvas, stubImage } from "../../test/image.js";
import { PhotoField } from "./PhotoField.jsx";

const PREVIEW = "blob:photo";

/** Open the editor over a photograph that is already in the draft. */
async function openEditor(user, onPick) {
  renderApp(<PhotoField preview={PREVIEW} onPick={onPick} />);
  await user.click(screen.getByRole("button", { name: text("contribute.crop") }));
  return screen.findByRole("group", { name: text("contribute.cropBox") });
}

describe("cropping and straightening the photograph", () => {
  let restoreImage;
  let onPick;

  beforeEach(() => {
    restoreImage = stubImage(1200, 800);
    onPick = vi.fn();
  });

  afterEach(() => {
    restoreImage();
    vi.restoreAllMocks();
  });

  it("offers the editor only once there is a photograph to edit", () => {
    stubCanvas();
    renderApp(<PhotoField preview={null} onPick={onPick} />);
    expect(screen.queryByRole("button", { name: text("contribute.crop") })).toBeNull();
  });

  it("hands back a cut photograph and leaves the original alone until then", async () => {
    const { seen } = stubCanvas();
    const user = userEvent.setup();
    await openEditor(user, onPick);

    expect(onPick).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: text("contribute.cropApply") }));

    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    const file = onPick.mock.calls[0][0];
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("image/jpeg");
    expect([seen.canvas.width, seen.canvas.height]).toEqual([1200, 800]);
  });

  it("turns the photograph, and the kept file turns with it", async () => {
    const { ctx, seen } = stubCanvas();
    const user = userEvent.setup();
    await openEditor(user, onPick);

    await user.click(screen.getByRole("button", { name: text("contribute.rotateRight") }));
    await user.click(screen.getByRole("button", { name: text("contribute.cropApply") }));

    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect([seen.canvas.width, seen.canvas.height]).toEqual([800, 1200]);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
  });

  it("mirrors the photograph, and the kept file is mirrored too", async () => {
    const { ctx, seen } = stubCanvas();
    const user = userEvent.setup();
    await openEditor(user, onPick);

    await user.click(screen.getByRole("button", { name: text("contribute.flip") }));
    await user.click(screen.getByRole("button", { name: text("contribute.cropApply") }));

    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    // A mirror keeps the photograph's shape; only the drawing is turned over.
    expect([seen.canvas.width, seen.canvas.height]).toEqual([1200, 800]);
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
  });

  it("moves the frame from the keyboard, for anyone without a pointer", async () => {
    stubCanvas();
    const user = userEvent.setup();
    const box = await openEditor(user, onPick);

    box.focus();
    // The frame opens on the whole photograph, so it is pulled in before it has
    // anywhere to go. Shift resizes; a bare arrow moves.
    await user.keyboard("{Shift>}{ArrowLeft}{ArrowUp}{/Shift}");
    expect(box.style.width).toBe("98%");
    expect(box.style.height).toBe("98%");

    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(box.style.left).toBe("2%");
    expect(box.style.top).toBe("2%");
  });

  it("leaves the photograph untouched when the sheet is closed", async () => {
    stubCanvas();
    const user = userEvent.setup();
    await openEditor(user, onPick);

    await user.click(screen.getByRole("button", { name: text("contribute.cropCancel") }));
    await waitFor(() =>
      expect(screen.queryByRole("group", { name: text("contribute.cropBox") })).toBeNull(),
    );
    expect(onPick).not.toHaveBeenCalled();
  });
});
