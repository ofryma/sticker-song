import { useReducedMotion } from "framer-motion";
import { useCollageCycle } from "../../hooks/useCollageCycle.js";
import { useWide } from "../../hooks/useWide.js";
import { slotsFor } from "./layout.js";
import { CollageTile } from "./CollageTile.jsx";

/**
 * The wall as a drifting collage: photographs fade in, hold, and give their
 * place to the next name in the archive, so over a minute of watching the whole
 * archive passes through. The stickers hang in an even lattice — straight, in
 * line with each other, each at the proportions it was photographed at.
 *
 * It is ambient, not a way to find someone — that is what the search is for, and
 * cycling stops while a search is open so nothing moves under the reader.
 */
export function Collage({ entries, onOpen, paused = false, full = false }) {
  const wide = useWide();
  const reduced = useReducedMotion();
  const slots = slotsFor(wide);
  const slotCount = Math.min(slots.length, entries.length);

  const { assigned, generation } = useCollageCycle({
    slotCount,
    total: entries.length,
    // Reduced motion keeps a still collage: composed, but never moving.
    paused: paused || Boolean(reduced),
  });

  if (entries.length === 0) return null;

  return (
    <div
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
