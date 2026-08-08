import { vi } from "vitest";

/**
 * jsdom neither decodes an image nor draws one, so the two browser pieces the
 * photo editor leans on are stood up here for the tests that need them.
 */

/** An `Image` that reports the given size and reports itself loaded at once. */
export function stubImage(width, height) {
  const original = globalThis.Image;
  globalThis.Image = class {
    constructor() {
      this.naturalWidth = width;
      this.naturalHeight = height;
      queueMicrotask(() => this.onload?.());
    }
  };
  return () => {
    globalThis.Image = original;
  };
}

/** A canvas that records what was drawn on it and encodes to a stub JPEG. */
export function stubCanvas() {
  const seen = {};
  const ctx = {
    fillStyle: "",
    fillRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(function grab() {
    seen.canvas = this;
    return ctx;
  });
  HTMLCanvasElement.prototype.toBlob = vi.fn((done) =>
    done(new Blob(["photo"], { type: "image/jpeg" })),
  );
  return { ctx, seen };
}
