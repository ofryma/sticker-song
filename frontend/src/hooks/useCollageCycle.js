import { useEffect, useRef, useState } from "react";

/**
 * Assigns entries to collage slots and rotates them one at a time.
 *
 * A single timer advances the next slot in round-robin order, so photographs
 * appear and disappear continuously but never all at once. `cursor` walks the
 * whole archive before repeating, so every name gets its turn.
 */
export function useCollageCycle({ slotCount, total, paused, stepMs = 2600 }) {
  const [assigned, setAssigned] = useState(() =>
    Array.from({ length: slotCount }, (_, i) => i),
  );
  // Bumped per slot so each new photograph mounts as a fresh element.
  const [generation, setGeneration] = useState(() => Array(slotCount).fill(0));
  const cursor = useRef(slotCount);
  const nextSlot = useRef(0);

  // Slot count changes with the breakpoint; start over rather than patch.
  useEffect(() => {
    setAssigned(Array.from({ length: slotCount }, (_, i) => i));
    setGeneration(Array(slotCount).fill(0));
    cursor.current = slotCount;
    nextSlot.current = 0;
  }, [slotCount]);

  useEffect(() => {
    // With nothing held back there is nothing to rotate in.
    if (paused || total <= slotCount) return;

    const timer = setInterval(() => {
      const slot = nextSlot.current % slotCount;
      nextSlot.current += 1;
      const entry = cursor.current % total;
      cursor.current += 1;

      setAssigned((current) => {
        const next = [...current];
        next[slot] = entry;
        return next;
      });
      setGeneration((current) => {
        const next = [...current];
        next[slot] += 1;
        return next;
      });
    }, stepMs);

    return () => clearInterval(timer);
  }, [paused, slotCount, total, stepMs]);

  return { assigned, generation };
}

/** True while the viewport is at least `query` wide. */
export function useWide(query = "(min-width: 640px)") {
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event) => setWide(event.matches);
    media.addEventListener("change", onChange);
    setWide(media.matches);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return wide;
}
