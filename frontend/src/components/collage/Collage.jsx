import { useReducedMotion } from "framer-motion";
import { useCollageCycle, useWide } from "../../hooks/useCollageCycle.js";
import { slotsFor } from "./layout.js";
import { CollageTile } from "./CollageTile.jsx";

/**
 * The wall as a drifting collage: photographs fade in, hold, and give their
 * place to the next name in the archive. Overlapping and slightly rotated, the
 * way stickers actually accumulate on a pole.
 *
 * It is ambient, not a way to find someone — that is what the search is for, and
 * cycling stops while a search is open so nothing moves under the reader.
 */
export function Collage({ entries, onOpen, paused = false }) {
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
      className="relative -mx-4 h-[128vh] overflow-hidden sm:mx-0 sm:h-[92vh]"
      aria-hidden={paused ? "true" : undefined}
    >
      {/* Light pooling behind the collage, so tiles sit in a room, not on a page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-drift bg-[radial-gradient(50%_40%_at_50%_35%,rgba(240,190,107,0.10),transparent_72%)]"
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

      {/* The collage dissolves into the page rather than ending on a hard edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-night to-transparent"
      />
    </div>
  );
}
