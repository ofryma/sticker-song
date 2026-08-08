import { afterEach, describe, expect, it, vi } from "vitest";
import { stubCanvas, stubImage } from "../test/image.js";
import {
  WHOLE,
  frameOf,
  isUntouched,
  jpegName,
  mirrorCrop,
  renderEdit,
  turnCrop,
} from "./image.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the rotated frame", () => {
  it("keeps its shape on a half turn and swaps sides on a quarter", () => {
    expect(frameOf(1200, 800, 0)).toEqual({ width: 1200, height: 800 });
    expect(frameOf(1200, 800, 180)).toEqual({ width: 1200, height: 800 });
    expect(frameOf(1200, 800, 90)).toEqual({ width: 800, height: 1200 });
    expect(frameOf(1200, 800, 270)).toEqual({ width: 800, height: 1200 });
  });
});

describe("a crop carried through a turn", () => {
  it("keeps hold of the same corner of the photograph", () => {
    // The top-left quarter goes to the top-right when the picture turns right.
    expect(turnCrop({ x: 0, y: 0, w: 0.5, h: 0.5 }, 1)).toEqual({
      x: 0.5,
      y: 0,
      w: 0.5,
      h: 0.5,
    });
  });

  it("comes back to itself after four turns, either way round", () => {
    const box = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    expect(turnCrop(box, 4)).toEqual(box);
    const back = turnCrop(turnCrop(box, 1), -1);
    for (const side of ["x", "y", "w", "h"]) expect(back[side]).toBeCloseTo(box[side]);
  });

  it("recognises the untouched photograph", () => {
    expect(isUntouched(0, WHOLE)).toBe(true);
    expect(isUntouched(90, WHOLE)).toBe(false);
    expect(isUntouched(0, WHOLE, true)).toBe(false);
    expect(isUntouched(0, { x: 0.1, y: 0, w: 0.9, h: 1 })).toBe(false);
  });
});

describe("a crop carried through a mirror", () => {
  it("moves to the other side of the frame and comes back", () => {
    const box = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    expect(mirrorCrop(box)).toEqual({ x: 0.6, y: 0.2, w: 0.3, h: 0.4 });
    const back = mirrorCrop(mirrorCrop(box));
    for (const side of ["x", "y", "w", "h"]) expect(back[side]).toBeCloseTo(box[side]);
  });

  it("leaves the whole frame where it is", () => {
    expect(mirrorCrop(WHOLE)).toEqual(WHOLE);
  });
});

describe("the kept photograph", () => {
  it("is cut to the crop, at the photograph's own resolution", async () => {
    const restore = stubImage(1200, 800);
    const { ctx, seen } = stubCanvas();
    try {
      const file = await renderEdit(
        "blob:photo",
        { rotation: 0, crop: { x: 0.25, y: 0.5, w: 0.5, h: 0.5 } },
        "wall.png",
      );
      expect(file).toBeInstanceOf(File);
      expect(file.type).toBe("image/jpeg");
      expect(file.name).toBe("wall.jpg");
      const canvas = seen.canvas;
      expect([canvas.width, canvas.height]).toEqual([600, 400]);
      // The frame's origin moves to the corner of the crop before drawing.
      expect(ctx.translate).toHaveBeenCalledWith(-300, -400);
      expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), -600, -400);
    } finally {
      restore();
    }
  });

  it("takes its size from the turned frame", async () => {
    const restore = stubImage(1200, 800);
    const { seen } = stubCanvas();
    try {
      await renderEdit("blob:photo", { rotation: 90, crop: WHOLE }, "wall.jpg");
      const canvas = seen.canvas;
      expect([canvas.width, canvas.height]).toEqual([800, 1200]);
    } finally {
      restore();
    }
  });

  it("is mirrored across the frame's upright axis when asked", async () => {
    const restore = stubImage(1200, 800);
    const { ctx } = stubCanvas();
    try {
      await renderEdit("blob:photo", { crop: WHOLE }, "wall.jpg");
      expect(ctx.scale).not.toHaveBeenCalled();
      await renderEdit("blob:photo", { crop: WHOLE, flipped: true }, "wall.jpg");
      expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    } finally {
      restore();
    }
  });

  it("names an unnamed photograph rather than leaving it bare", () => {
    expect(jpegName(null)).toBe("sticker.jpg");
    expect(jpegName("IMG_0421.HEIC")).toBe("IMG_0421.jpg");
  });
});
