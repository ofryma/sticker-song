import { Sticker } from "../Sticker.jsx";

/**
 * One photograph in a drifting column: the sticker at the full width of the
 * column, at the proportions it was photographed at, and openable wherever it
 * happens to be on its way down.
 */
export function CollageTile({ entry, onOpen, hidden = false }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      aria-label={entry.person_name}
      aria-hidden={hidden ? "true" : undefined}
      tabIndex={hidden ? -1 : undefined}
      className="group focus-visible:ring-tekhelet/70 block w-full rounded-sm
        focus-visible:ring-2 focus-visible:outline-none"
    >
      <Sticker
        entry={entry}
        className="w-full shadow-[0_14px_34px_-26px_rgba(33,30,24,0.45)]"
        imageClassName="group-hover:scale-[1.02]"
      />
    </button>
  );
}
