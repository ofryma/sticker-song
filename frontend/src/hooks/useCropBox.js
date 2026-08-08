import { useCallback, useRef, useState } from "react";
import { WHOLE, isUntouched, mirrorCrop, turnCrop } from "../lib/image.js";

/* The element the photograph is drawn in, which a drag is measured against. */
const FRAME = "[data-crop-frame]";
/* A crop is never allowed to close to nothing, and a key press moves it by a
   small, predictable amount rather than a nudge nobody can see. */
const MIN = 0.08;
const STEP = 0.02;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** The whole rectangle, moved, staying inside the frame. */
function shift(box, dx, dy) {
  return {
    ...box,
    x: clamp(box.x + dx, 0, 1 - box.w),
    y: clamp(box.y + dy, 0, 1 - box.h),
  };
}

/** One edge or corner pulled, the opposite side staying where it is. */
function resize(box, handle, dx, dy) {
  let { x, y, w, h } = box;
  if (handle.includes("w")) {
    const left = clamp(x + dx, 0, x + w - MIN);
    w = x + w - left;
    x = left;
  }
  if (handle.includes("e")) w = clamp(w + dx, MIN, 1 - x);
  if (handle.includes("n")) {
    const top = clamp(y + dy, 0, y + h - MIN);
    h = y + h - top;
    y = top;
  }
  if (handle.includes("s")) h = clamp(h + dy, MIN, 1 - y);
  return { x, y, w, h };
}

const ARROWS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * The crop rectangle and the quarter turn, and the pointer and keyboard
 * gestures that change them. Everything is normalised to the rotated frame: the
 * caller marks that element `data-crop-frame` and a drag is measured against it.
 */
export function useCropBox() {
  const drag = useRef(null);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [crop, setCrop] = useState(WHOLE);

  const begin = useCallback(
    (handle) => (event) => {
      // The frame is found from the gesture itself rather than held in a ref,
      // so the hook never reaches into the tree it is driving.
      const bounds = event.currentTarget.closest(FRAME)?.getBoundingClientRect();
      if (!bounds?.width || !bounds?.height) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = { handle, bounds, from: { x: event.clientX, y: event.clientY }, start: crop };
    },
    [crop],
  );

  const move = useCallback((event) => {
    const state = drag.current;
    if (!state) return;
    const dx = (event.clientX - state.from.x) / state.bounds.width;
    const dy = (event.clientY - state.from.y) / state.bounds.height;
    setCrop(
      state.handle === "move"
        ? shift(state.start, dx, dy)
        : resize(state.start, state.handle, dx, dy),
    );
  }, []);

  const end = useCallback(() => {
    drag.current = null;
  }, []);

  /* Reachable without a pointer: arrows move the frame, shift resizes it. */
  const key = useCallback((event) => {
    const arrow = ARROWS[event.key];
    if (!arrow) return;
    event.preventDefault();
    const [dx, dy] = [arrow[0] * STEP, arrow[1] * STEP];
    setCrop((current) => (event.shiftKey ? resize(current, "se", dx, dy) : shift(current, dx, dy)));
  }, []);

  const rotate = useCallback((quarters) => {
    setRotation((current) => (current + quarters * 90 + 360) % 360);
    setCrop((current) => turnCrop(current, quarters));
  }, []);

  /* The frame is mirrored with the picture, so the crop keeps its subject. */
  const flip = useCallback(() => {
    setFlipped((current) => !current);
    setCrop((current) => mirrorCrop(current));
  }, []);

  const reset = useCallback(() => {
    setRotation(0);
    setFlipped(false);
    setCrop(WHOLE);
  }, []);

  return {
    rotation,
    flipped,
    crop,
    touched: !isUntouched(rotation, crop, flipped),
    begin,
    move,
    end,
    key,
    rotate,
    flip,
    reset,
  };
}
