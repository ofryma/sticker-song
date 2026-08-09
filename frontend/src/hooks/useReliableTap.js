import { useCallback, useRef } from "react";

/* How far a finger may travel and still count as having stayed put. A person
   holding still moves a few pixels; anyone scrolling moves far more. */
const DRIFT = 24;

/**
 * A tap that survives the page moving under the finger.
 *
 * On a phone the on-screen keyboard closes as a finger comes down on the button
 * below the field somebody has just been writing in. The page reflows, the
 * button slides out from under the touch, and the browser fires no click at all
 * — so nothing happens, and nothing explains why. This completes a tap that
 * began on the element even when the element has moved away from it, and steps
 * aside whenever the layout held still, leaving the ordinary click to do the
 * work.
 *
 * Spread the returned handlers onto the element that is being tapped.
 */
export function useReliableTap(onTrigger) {
  const began = useRef(null);

  const onTouchStart = useCallback((event) => {
    const touch = event.touches[0];
    began.current = touch
      ? { element: event.currentTarget, x: touch.clientX, y: touch.clientY }
      : null;
  }, []);

  const onTouchEnd = useCallback(
    (event) => {
      const start = began.current;
      began.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch) return;

      const box = start.element.getBoundingClientRect();
      const overIt = touch.clientX >= box.left && touch.clientX <= box.right;
      const inside = overIt && touch.clientY >= box.top && touch.clientY <= box.bottom;
      // Still on the element: a click is on its way and will do the work.
      if (inside) return;

      const travelled = Math.abs(touch.clientX - start.x) + Math.abs(touch.clientY - start.y);
      // The finger left on purpose — a scroll, or a change of mind. Let it go.
      if (!overIt || travelled > DRIFT) return;

      // No click will follow this, so nothing can happen twice.
      event.preventDefault();
      onTrigger();
    },
    [onTrigger],
  );

  return { onTouchStart, onTouchEnd };
}
