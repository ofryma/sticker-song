import { useCallback, useEffect, useRef, useState } from "react";

/* Kept this far inside the window, so a dragged control never ends up half off
   the screen or under a rounded corner. */
const MARGIN = 8;

/* A finger wanders a little on the way to a tap. Past this it is a drag, and
   whatever the control does on a press does not happen. */
const THRESHOLD = 6;

function read(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (stored && typeof stored.dx === "number" && typeof stored.dy === "number") return stored;
  } catch {
    // A device that refuses storage still drags for this visit.
  }
  return { dx: 0, dy: 0 };
}

function save(key, offset) {
  try {
    localStorage.setItem(key, JSON.stringify(offset));
  } catch {
    // As above: not being able to remember it is not a reason to refuse it.
  }
}

/**
 * Move a fixed control out of the way, and remember where it was put.
 *
 * A control that sits over the page will sooner or later sit over the one thing
 * somebody wanted to read. Rather than choose a corner for everybody, this lets
 * a visitor drag it wherever it suits them, keeps it inside the window, and
 * keeps the position on their device.
 *
 * Spread `handlers` and `style` onto the element and give it `attach` as its ref.
 * Ask `wasDragged()` inside the press handler, so a drag does not also count as
 * a tap.
 */
export function useDraggable(storageKey) {
  const [offset, setOffset] = useState(() => read(storageKey));
  const [dragging, setDragging] = useState(false);
  const element = useRef(null);
  const from = useRef(null);
  const dragged = useRef(false);
  /* The offset as last rendered, for the handlers and the clamp below — both run
     outside a render and need the current value, not the one they closed over. */
  const latest = useRef(offset);
  useEffect(() => {
    latest.current = offset;
  }, [offset]);

  /* Where the element sits with no offset applied — its place in the layout,
     which is what a clamp has to be worked out from. */
  const anchor = useCallback(() => {
    const box = element.current.getBoundingClientRect();
    const { dx, dy } = latest.current;
    return { left: box.left - dx, top: box.top - dy, width: box.width, height: box.height };
  }, []);

  const clamp = useCallback((base, dx, dy) => {
    const room = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));
    return {
      dx: room(dx, MARGIN - base.left, window.innerWidth - MARGIN - base.width - base.left),
      dy: room(dy, MARGIN - base.top, window.innerHeight - MARGIN - base.height - base.top),
    };
  }, []);

  const onPointerDown = useCallback(
    (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      dragged.current = false;
      from.current = { x: event.clientX, y: event.clientY, offset: latest.current, base: anchor() };
      setDragging(true);
    },
    [anchor],
  );

  useEffect(() => {
    if (!dragging) return;

    const move = (event) => {
      const start = from.current;
      if (!start) return;
      const mx = event.clientX - start.x;
      const my = event.clientY - start.y;
      if (Math.abs(mx) + Math.abs(my) > THRESHOLD) dragged.current = true;
      setOffset(clamp(start.base, start.offset.dx + mx, start.offset.dy + my));
    };

    const end = () => {
      setDragging(false);
      from.current = null;
      if (dragged.current) save(storageKey, latest.current);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [clamp, dragging, storageKey]);

  /* A window that turned or shrank can leave a remembered position outside it. */
  useEffect(() => {
    const settle = () => {
      if (!element.current) return;
      setOffset((current) => clamp(anchor(), current.dx, current.dy));
    };
    settle();
    window.addEventListener("resize", settle);
    window.addEventListener("orientationchange", settle);
    return () => {
      window.removeEventListener("resize", settle);
      window.removeEventListener("orientationchange", settle);
    };
  }, [anchor, clamp]);

  /* A callback rather than the ref itself: the element is the hook's business,
     and nothing outside it has any reason to hold on to one. */
  const attach = useCallback((node) => {
    element.current = node;
  }, []);

  return {
    attach,
    /* On the way down, not on the way up: HeroUI's button stops `pointerdown`
       from bubbling, so a handler waiting for it to arrive never hears it. */
    handlers: { onPointerDownCapture: onPointerDown },
    style: { transform: `translate(${offset.dx}px, ${offset.dy}px)` },
    dragging,
    wasDragged: () => dragged.current,
  };
}
