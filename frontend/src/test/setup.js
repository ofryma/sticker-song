import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest globals are off, so RTL's automatic cleanup does not install itself.
afterEach(cleanup);

// jsdom implements neither of these, and the draft flow uses both to show a
// preview of the chosen photograph.
let objectUrls = 0;
URL.createObjectURL = vi.fn(() => `blob:test/${++objectUrls}`);
URL.revokeObjectURL = vi.fn();

// HeroUI's tabs measure themselves to place the selected marker; jsdom has no
// layout, so an observer that never fires is exactly right here.
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Nothing under test cares about the breakpoint, but the collage asks.
window.matchMedia = vi.fn((query) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}));
