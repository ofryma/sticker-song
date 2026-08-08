import { AnimatePresence, motion } from "framer-motion";
import { ratioOf } from "../../lib/format.js";
import { Sticker } from "../Sticker.jsx";
import { fitWidth, slotStyle } from "./layout.js";

/* Long, symmetrical crossfade: one photograph leaves as the next arrives. */
const TRANSITION = { duration: 2.2, ease: [0.16, 0.8, 0.24, 1] };

/** One cell of the collage — holds a single photograph at a time. */
export function CollageTile({ slot, entry, generation, onOpen, still }) {
  return (
    <div className="collage-cell absolute" style={slotStyle(slot)}>
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
          /* Each photograph sits in the middle of its cell, as large as the cell
             takes at the sticker's own proportions. Centred with a transform so
             the crossfading pair can overlap in the same place. */
          style={{ width: fitWidth(ratioOf(entry)), x: "-50%", y: "-50%" }}
          className="group focus-visible:ring-tekhelet/70 absolute top-1/2 left-1/2 block rounded-sm
            focus-visible:ring-2 focus-visible:outline-none"
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
