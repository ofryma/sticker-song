import { AnimatePresence, motion } from "framer-motion";
import { ratioOf } from "../../lib/format.js";
import { Sticker } from "../Sticker.jsx";
import { tileWidth } from "./layout.js";

/* Long, symmetrical crossfade: one photograph leaves as the next arrives. */
const TRANSITION = { duration: 2.2, ease: [0.16, 0.8, 0.24, 1] };

/** One cell of the collage — holds a single photograph at a time. */
export function CollageTile({ slot, grid, entry, generation, onOpen, still }) {
  return (
    <div className="absolute" style={{ left: slot.x, top: slot.y }}>
      <AnimatePresence mode="sync" initial={false}>
        <motion.button
          key={`${entry.id}-${generation}`}
          type="button"
          onClick={() => onOpen(entry)}
          aria-label={entry.person_name}
          initial={still ? false : { opacity: 0, filter: "blur(6px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(6px)" }}
          transition={TRANSITION}
          /* Every photograph is given the same footprint, whatever its
             proportions, and is centred on its cell with a transform so the
             crossfading pair can overlap in the same place. `left`/`top` are
             pinned rather than left to resolve on their own: the archive reads
             right to left in Hebrew, and an unpinned absolute box would hang
             from the other edge and pull the whole wall off centre. */
          style={{ left: 0, top: 0, width: tileWidth(ratioOf(entry), grid), x: "-50%", y: "-50%" }}
          className="group focus-visible:ring-tekhelet/70 absolute block rounded-sm
            hover:z-10 focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Sticker
            entry={entry}
            className="w-full shadow-[0_14px_34px_-26px_rgba(33,30,24,0.45)]"
            imageClassName="group-hover:scale-[1.02]"
          />
        </motion.button>
      </AnimatePresence>
    </div>
  );
}
