import { Sticker } from "./Sticker.jsx";

/**
 * One sticker on the wall. Just the photograph, at the proportions it was shot
 * at, with the name on a strip of parchment in its lower corner. No frame and no
 * caption beneath — the sticker speaks for itself; the record opens on a click.
 */
export function EntryCard({ entry, index = 0, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="group focus-visible:ring-tekhelet/70 duration-1200 ease-calm animate-rise block w-full
        rounded-sm text-start focus-visible:ring-2 focus-visible:outline-none"
      /* Staggered, but capped so a long page never crawls into view. */
      style={{ animationDelay: `${Math.min(index, 11) * 90}ms` }}
    >
      <Sticker
        entry={entry}
        className="w-full shadow-[0_12px_30px_-24px_rgba(33,30,24,0.45)]"
        imageClassName="group-hover:scale-[1.02]"
      />
    </button>
  );
}
