import { CollageTile } from "./CollageTile.jsx";
import { driftFor } from "./layout.js";

/**
 * One column of the wall, travelling downwards.
 *
 * The column holds two identical runs of the same photographs; the whole thing
 * starts half its height above the canvas and ends level with it, so at the
 * moment the animation restarts the picture under any point on the screen is
 * the one that was already there. Nothing appears or disappears in place — a
 * photograph enters at the top edge and leaves at the bottom.
 */
export function CollageColumn({ column, width, height, gap, index, columns, onOpen, paused }) {
  const { repeat, seconds } = driftFor(column, width, height, gap);
  // A run long enough to reach past the bottom of the canvas on its own.
  const run = Array.from({ length: repeat }, () => column).flat();

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      <div
        className="motion-safe:animate-fall absolute inset-x-0 top-0 flex flex-col"
        style={{
          gap,
          animationDuration: `${seconds}s`,
          // Columns are set off against each other so the wall never reads as
          // one block of pictures sliding down together.
          animationDelay: `-${(seconds * index) / Math.max(columns, 1)}s`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {[0, 1].map((copy) =>
          run.map((entry, position) => (
            <CollageTile
              key={`${copy}-${position}-${entry.id}`}
              entry={entry}
              onOpen={onOpen}
              // The second run is the same wall said twice; a reader hears the
              // names once.
              hidden={copy === 1}
            />
          )),
        )}
      </div>
    </div>
  );
}
