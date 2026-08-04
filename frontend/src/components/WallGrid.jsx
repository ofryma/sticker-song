import { EntryCard } from "./EntryCard.jsx";

/**
 * The wall. A CSS-columns masonry so stickers sit at their natural rhythm
 * instead of a rigid grid — closer to how they actually appear on a street.
 */
export function WallGrid({ entries, onOpen }) {
  return (
    <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4 [column-fill:balance]">
      {entries.map((entry, index) => (
        <div key={entry.id} className="mb-5 break-inside-avoid">
          <EntryCard entry={entry} index={index} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}
