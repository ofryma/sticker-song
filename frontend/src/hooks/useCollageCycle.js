import { useEffect, useState } from "react";

/** A fresh round of assignments for `slotCount` slots. */
function freshCycle(slotCount) {
  return {
    slotCount,
    assigned: Array.from({ length: slotCount }, (_, i) => i),
    // Bumped per slot so each new photograph mounts as a fresh element.
    generation: Array(slotCount).fill(0),
    // How far through the archive we have walked, and whose turn is next.
    cursor: slotCount,
    nextSlot: 0,
  };
}

/** Move one slot on to the next entry. Pure: it only derives the next state. */
function advance(cycle, total) {
  const slot = cycle.nextSlot % cycle.slotCount;
  const assigned = [...cycle.assigned];
  assigned[slot] = cycle.cursor % total;
  const generation = [...cycle.generation];
  generation[slot] += 1;
  return {
    ...cycle,
    assigned,
    generation,
    cursor: cycle.cursor + 1,
    nextSlot: cycle.nextSlot + 1,
  };
}

/**
 * Assigns entries to collage slots and rotates them one at a time.
 *
 * A single timer advances the next slot in round-robin order, so photographs
 * appear and disappear continuously but never all at once. `cursor` walks the
 * whole archive before repeating, so every name gets its turn.
 *
 * Cursor and slot position live in the same state object as the assignments, so
 * a tick is one pure update and nothing has to be mutated on the side.
 *
 * `onNeedMore` is called as the cursor comes within a screenful of the end of
 * what has been loaded, so the next page of the archive is fetched while the
 * last of the current one is still on the wall — a large archive arrives a page
 * at a time and the collage never has to wait for it.
 */
export function useCollageCycle({ slotCount, total, paused, stepMs = 2600, onNeedMore }) {
  const [cycle, setCycle] = useState(() => freshCycle(slotCount));

  // Slot count changes with the breakpoint; start over rather than patch. Done
  // during render rather than in an effect, so no frame is painted with the old
  // number of slots — React throws this render away and immediately redoes it.
  if (cycle.slotCount !== slotCount) setCycle(freshCycle(slotCount));

  useEffect(() => {
    // With nothing held back there is nothing to rotate in.
    if (paused || total <= slotCount) return;

    const timer = setInterval(() => {
      // The guard covers a tick landing between a breakpoint change and this
      // effect being torn down and set up again.
      setCycle((current) => (current.slotCount === slotCount ? advance(current, total) : current));
    }, stepMs);

    return () => clearInterval(timer);
  }, [paused, slotCount, total, stepMs]);

  const current = cycle.slotCount === slotCount ? cycle : freshCycle(slotCount);

  // Asked for once per cursor position: `onNeedMore` is free to decline, and
  // the request repeats on the next tick if the archive did not grow.
  useEffect(() => {
    if (current.cursor >= total - slotCount) onNeedMore?.();
  }, [current.cursor, slotCount, total, onNeedMore]);

  return { assigned: current.assigned, generation: current.generation, cursor: current.cursor };
}
