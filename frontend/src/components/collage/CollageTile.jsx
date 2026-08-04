import { AnimatePresence, motion } from "framer-motion";
import { thumbUrl } from "../../lib/api.js";
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
          className="group border-day-line bg-day focus-visible:ring-tekhelet/70 absolute inset-x-0
            top-0 block origin-center overflow-hidden rounded-sm border p-1.5
            shadow-[0_14px_34px_-22px_rgba(33,30,24,0.45)] focus-visible:ring-2
            focus-visible:outline-none"
        >
          {/* Photograph, then a paper strip under it — a printed sticker rather
              than a name written across someone's face. */}
          <span className="bg-day-warm block aspect-4/5 overflow-hidden rounded-[1px]">
            <img
              src={thumbUrl(entry)}
              alt={t("entry.photo", { name: entry.person_name })}
              loading="lazy"
              decoding="async"
              className="duration-2400 ease-calm h-full w-full object-cover transition-transform
                group-hover:scale-[1.02]"
            />
          </span>
          <span className="pointer-events-none block px-0.5 pt-1.5 pb-0.5 text-start">
            <span className="text-ink block truncate font-serif text-[0.8rem] leading-tight sm:text-sm">
              {entry.person_name}
            </span>
          </span>
        </motion.button>
      </AnimatePresence>
    </div>
  );
}
