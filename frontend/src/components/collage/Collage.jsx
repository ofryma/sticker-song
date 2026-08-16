import { useEffect } from "react";
import { useMeasure } from "../../hooks/useMeasure.js";
import { useWide } from "../../hooks/useWide.js";
import { columnsFor, splitColumns } from "./layout.js";
import { CollageColumn } from "./CollageColumn.jsx";

/* The daylight between two photographs, in pixels. Tight, like a pasted wall. */
const GAP = { wide: 10, narrow: 6 };

/* How much of the archive the wall carries at once before it stops asking. */
const CEILING = 90;

/**
 * The wall as a drifting collage: columns of photographs travel slowly
 * downwards, entering at the top edge and leaving at the bottom, so over a few
 * minutes of watching the whole archive walks past. The stickers are packed
 * tight — each is the full width of its column, at the proportions it was
 * photographed at — and nothing appears or disappears in place.
 *
 * It is ambient, not a way to find someone — that is what the search is for, and
 * the drift holds still while a search is open so nothing moves under the reader.
 *
 * Only what has been loaded is on the wall: it asks for the next page through
 * `onNeedMore` until it is carrying a screenful of columns several times over,
 * so a large archive arrives a page at a time rather than being fetched whole.
 */
export function Collage({ entries, onOpen, paused = false, full = false, onNeedMore }) {
  const wide = useWide();
  // Columns are laid out against the canvas's real size: how many fit across
  // it, and how tall a run of photographs has to be to cross it.
  const [canvasRef, canvas] = useMeasure();
  const gap = wide ? GAP.wide : GAP.narrow;
  const count = columnsFor(canvas.width, wide);
  const columns = splitColumns(entries, count);
  const columnWidth = count > 0 ? (canvas.width - gap * (count - 1)) / count : 0;

  useEffect(() => {
    if (entries.length > 0 && entries.length < CEILING) onNeedMore?.();
  }, [entries.length, onNeedMore]);

  if (entries.length === 0) return null;

  return (
    <div
      ref={canvasRef}
      className={[
        "relative w-full overflow-hidden",
        // In the page the collage is a tall band across the whole width; given
        // the whole screen it simply takes the room it is handed.
        full ? "h-full" : "h-[128vh] sm:h-[92vh]",
      ].join(" ")}
      aria-hidden={paused ? "true" : undefined}
    >
      {/* Daylight pooling behind the collage, so the tiles sit in warm light. */}
      <div
        aria-hidden="true"
        className="animate-drift pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_35%,rgba(224,160,60,0.16),transparent_72%)]"
      />

      <div className="absolute inset-0 flex" style={{ gap }}>
        {columns.map((column, index) => (
          <CollageColumn
            key={index}
            column={column}
            width={columnWidth}
            height={canvas.height}
            gap={gap}
            index={index}
            columns={columns.length}
            onOpen={onOpen}
            paused={paused}
          />
        ))}
      </div>
    </div>
  );
}
