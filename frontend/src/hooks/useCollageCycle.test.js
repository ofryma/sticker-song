import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollageCycle, useWide } from "./useCollageCycle.js";

const STEP = 2600;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Let `count` timer steps elapse. */
function tick(count = 1) {
  act(() => vi.advanceTimersByTime(STEP * count));
}

describe("useCollageCycle", () => {
  it("fills the slots with the first entries and no rotations yet", () => {
    const { result } = renderHook(() => useCollageCycle({ slotCount: 3, total: 9, paused: false }));

    expect(result.current.assigned).toEqual([0, 1, 2]);
    expect(result.current.generation).toEqual([0, 0, 0]);
  });

  it("advances one slot per step, round-robin, continuing through the archive", () => {
    const { result } = renderHook(() => useCollageCycle({ slotCount: 3, total: 9, paused: false }));

    tick();
    expect(result.current.assigned).toEqual([3, 1, 2]);
    expect(result.current.generation).toEqual([1, 0, 0]);

    tick(2);
    expect(result.current.assigned).toEqual([3, 4, 5]);
    expect(result.current.generation).toEqual([1, 1, 1]);

    // Round two lands on the next three names, not back on the first.
    tick();
    expect(result.current.assigned).toEqual([6, 4, 5]);
    expect(result.current.generation).toEqual([2, 1, 1]);
  });

  it("wraps round to the start once every name has had its turn", () => {
    const { result } = renderHook(() => useCollageCycle({ slotCount: 2, total: 3, paused: false }));

    tick(2);
    expect(result.current.assigned).toEqual([2, 0]);
  });

  it("holds still while paused, and when the archive fills every slot", () => {
    const paused = renderHook(() => useCollageCycle({ slotCount: 3, total: 9, paused: true }));
    tick(5);
    expect(paused.result.current.assigned).toEqual([0, 1, 2]);

    const full = renderHook(() => useCollageCycle({ slotCount: 3, total: 3, paused: false }));
    tick(5);
    expect(full.result.current.assigned).toEqual([0, 1, 2]);
  });

  it("starts the round over when the breakpoint changes the slot count", () => {
    const { result, rerender } = renderHook((props) => useCollageCycle(props), {
      initialProps: { slotCount: 3, total: 9, paused: false },
    });
    tick(2);
    expect(result.current.assigned).toEqual([3, 4, 2]);

    rerender({ slotCount: 5, total: 9, paused: false });

    // A clean round of five, and the cursor picks up after them.
    expect(result.current.assigned).toEqual([0, 1, 2, 3, 4]);
    expect(result.current.generation).toEqual([0, 0, 0, 0, 0]);
    tick();
    expect(result.current.assigned).toEqual([5, 1, 2, 3, 4]);
  });
});

describe("useWide", () => {
  it("reads the media query, and follows it when it changes", () => {
    let notify;
    const media = {
      matches: false,
      addEventListener: (_event, handler) => (notify = handler),
      removeEventListener: () => {},
    };
    window.matchMedia = vi.fn(() => media);

    const { result } = renderHook(() => useWide("(min-width: 640px)"));
    expect(result.current).toBe(false);

    media.matches = true;
    act(() => notify());
    expect(result.current).toBe(true);
  });
});
