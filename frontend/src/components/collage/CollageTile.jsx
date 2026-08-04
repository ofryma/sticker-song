import { AnimatePresence, motion } from "framer-motion";
import { imageUrl } from "../../lib/api.js";
import { useI18n } from "../../i18n/index.jsx";
import { slotStyle } from "./layout.js";

/* Long, symmetrical crossfade: one photograph leaves as the next arrives. */
const TRANSITION = { duration: 2.2, ease: [0.16, 0.8, 0.24, 1] };

/** One slot on the collage — holds a single photograph at a time. */
export function CollageTile({ slot, entry, generation, onOpen, still }) {
  const { t } = useI18n();

  return (
    <div className="absolute" style={slotStyle(slot)}>
      <AnimatePresence mode="sync" initial={false}>
        <motion.button
          key={`${entry.id}-${generation}`}
          type="button"
          onClick={() => onOpen(entry)}
          aria-label={entry.person_name}
          initial={still ? false : { opacity: 0, scale: 0.97, filter: "blur(6px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 1.02, filter: "blur(6px)" }}
          transition={TRANSITION}
          className="group absolute inset-x-0 top-0 block origin-center overflow-hidden rounded-sm
            border border-stone-200/10 bg-night-soft shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]
            focus-visible:ring-2 focus-visible:ring-flame/70 focus-visible:outline-none"
        >
          <span className="relative block aspect-4/5">
            <img
              src={imageUrl(entry)}
              alt={t("entry.photo", { name: entry.person_name })}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover grayscale-[0.3] transition-all duration-2400
                ease-memorial group-hover:grayscale-0"
            />
            {/* The name stays legible without a caption bar competing with the photo. */}
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/95 via-night/25 to-transparent" />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5 text-start">
              <span className="block truncate font-serif text-[0.8rem] leading-tight text-stone-50 sm:text-sm">
                {entry.person_name}
              </span>
            </span>
          </span>
        </motion.button>
      </AnimatePresence>
    </div>
  );
}
