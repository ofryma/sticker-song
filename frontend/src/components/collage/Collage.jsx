import { useReducedMotion } from "framer-motion";
import { useCollageCycle } from "../../hooks/useCollageCycle.js";
import { usePrefetchThumbs } from "../../hooks/usePrefetchThumbs.js";
import { useMeasure } from "../../hooks/useMeasure.js";
import { useWide } from "../../hooks/useWide.js";
import { gridFor, slotsFor } from "./layout.js";
import { CollageTile } from "./CollageTile.jsx";

/**
 * The wall as a drifting collage: photographs fade in, hold, and give their
 * place to the next name in the archive, so over a minute of watching the whole
 * archive passes through. The stickers hang in a close lattice — straight, in
 * line with each other, each kept at the proportions it was photographed at but
 * scaled to the same footprint as its neighbours, so they sit shoulder to
 * shoulder and overlap a little, like a wall they were pasted onto.
 *
 * It is ambient, not a way to find someone — that is what the search is for, and
 * cycling stops while a search is open so nothing moves under the reader.
 *
 * Only what has been loaded is on the wall: as the cycle nears the end of the
 * loaded entries it asks for the next page through `onNeedMore`, so an archive
 * of any size is walked a page at a time rather than fetched whole.
 */
export function Collage({ entries, onOpen, paused = false, full = false, onNeedMore }) {
  const wide = useWide();
  const reduced = useReducedMotion();
  // The lattice is laid out against the canvas's real size: every sticker is
  // given the same footprint, which needs its width and height together.
  const [canvasRef, canvas] = useMeasure();
  const grid = gridFor(canvas.width, canvas.height, wide);
  const slots = slotsFor(grid);
  const slotCount = Math.min(slots.length, entries.length);

  const { assigned, generation, cursor } = useCollageCycle({
    slotCount,
    total: entries.length,
    // Reduced motion keeps a still collage: composed, but never moving.
    paused: paused || Boolean(reduced),
    onNeedMore,
  });

  usePrefetchThumbs(entries, cursor);

  if (entries.length === 0) return null;

  return (
    <div
      ref={canvasRef}
      className={[
        "relative overflow-hidden",
        // In the page the collage is a tall band that bleeds to the edges; given
        // the whole screen it simply takes the room it is handed.
        full ? "h-full w-full" : "-mx-4 h-[128vh] sm:mx-0 sm:h-[92vh]",
      ].join(" ")}
      aria-hidden={paused ? "true" : undefined}
    >
      {/* Daylight pooling behind the collage, so the tiles sit in warm light. */}
      <div
        aria-hidden="true"
        className="animate-drift pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_35%,rgba(224,160,60,0.16),transparent_72%)]"
      />

      {slots.slice(0, slotCount).map((slot, index) => {
        const entry = entries[assigned[index] % entries.length];
        if (!entry) return null;
        return (
          <CollageTile
            key={index}
            slot={slot}
            grid={grid}
            entry={entry}
            generation={generation[index]}
            onOpen={onOpen}
            still={Boolean(reduced)}
          />
        );
      })}

      {/* In the page the collage dissolves into what follows rather than ending
          on a hard edge. On the full screen there is nothing below to meet. */}
      {!full && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-day to-transparent"
        />
      )}
    </div>
  );
}
