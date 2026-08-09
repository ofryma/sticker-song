import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReliableTap } from "./useReliableTap.js";

/* Where the button is, from the test's point of view. The page moving under a
   finger is this rectangle moving between touchstart and touchend. */
function Button({ onTrigger, box }) {
  const tap = useReliableTap(onTrigger);
  return (
    <button
      type="button"
      ref={(node) => {
        if (node) node.getBoundingClientRect = () => box.current;
      }}
      {...tap}
    >
      send
    </button>
  );
}

const AT = { left: 20, right: 370, top: 400, bottom: 440 };

/** A finger down at (x, y), the button moved to `moved`, then the finger up. */
function tap({ from, to = from, moved = AT }) {
  const box = { current: { ...AT } };
  const onTrigger = vi.fn();
  render(<Button onTrigger={onTrigger} box={box} />);
  const button = screen.getByRole("button");

  fireEvent.touchStart(button, { touches: [{ clientX: from.x, clientY: from.y }] });
  box.current = moved;
  const ended = fireEvent.touchEnd(button, {
    changedTouches: [{ clientX: to.x, clientY: to.y }],
    cancelable: true,
  });
  return { onTrigger, clickFollows: ended };
}

describe("useReliableTap", () => {
  it("leaves an ordinary tap alone, so the click does the work once", () => {
    const { onTrigger, clickFollows } = tap({ from: { x: 195, y: 420 } });

    expect(onTrigger).not.toHaveBeenCalled();
    expect(clickFollows).toBe(true);
  });

  it("completes a tap when the button moves out from under a still finger", () => {
    // What a closing keyboard does: the page reflows and the button slides up.
    const { onTrigger, clickFollows } = tap({
      from: { x: 195, y: 420 },
      moved: { left: 20, right: 370, top: 280, bottom: 320 },
    });

    expect(onTrigger).toHaveBeenCalledTimes(1);
    // The click is called off, so the press cannot also arrive the usual way.
    expect(clickFollows).toBe(false);
  });

  it("does nothing when the finger scrolled the page away instead", () => {
    const { onTrigger } = tap({
      from: { x: 195, y: 420 },
      to: { x: 195, y: 180 },
      moved: { left: 20, right: 370, top: 160, bottom: 200 },
    });

    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("does nothing when the finger left the button sideways", () => {
    const { onTrigger } = tap({
      from: { x: 195, y: 420 },
      to: { x: 8, y: 420 },
      moved: { left: 20, right: 370, top: 280, bottom: 320 },
    });

    expect(onTrigger).not.toHaveBeenCalled();
  });
});
