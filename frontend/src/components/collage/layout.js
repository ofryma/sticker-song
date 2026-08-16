/**
 * Geometry for the collage, in pixels against the measured canvas.
 *
 * The wall is a set of columns that drift downwards: photographs enter at the
 * top, pass the reader, and leave at the bottom, the way a wall of pasted-up
 * stickers would if you walked along it. Because nothing appears or disappears
 * in place, the stickers can be packed tight — each column is a single stack at
 * the full width of the column, at the proportions it was photographed at.
 *
 * Each column carries its own stack, repeated enough times to reach past the
 * bottom of the canvas and then doubled, so the drift loops without a seam.
 */

import { ratioOf } from "../../lib/format.js";

/* The width a column aims for; the canvas is divided into as many as fit. */
const COLUMN_WIDTH = { wide: 260, narrow: 180 };

/* How many columns the wall will ever hold, however wide or narrow the screen. */
const COLUMNS = { min: 2, max: 6 };

/* How fast the wall drifts, in pixels a second. A slow walk, never a scroll. */
const SPEED = 24;

/** How many columns a canvas of this width carries. */
export function columnsFor(width, wide) {
  if (width <= 0) return 0;
  const fit = Math.round(width / (wide ? COLUMN_WIDTH.wide : COLUMN_WIDTH.narrow));
  return Math.min(COLUMNS.max, Math.max(COLUMNS.min, fit));
}

/**
 * The archive dealt out over the columns, one photograph at a time, so
 * neighbouring names sit side by side rather than one above the other.
 */
export function splitColumns(entries, cols) {
  if (cols <= 0) return [];
  const columns = Array.from({ length: cols }, () => []);
  entries.forEach((entry, index) => columns[index % cols].push(entry));
  return columns.filter((column) => column.length > 0);
}

/**
 * How the drift is timed for one column: the stack repeated `repeat` times so
 * it is taller than the canvas, and the seconds that run of photographs takes
 * to travel its own height. Every column moves at the same speed — a shorter
 * stack simply comes round again sooner.
 */
export function driftFor(column, columnWidth, canvasHeight, gap) {
  const stack = column.reduce((total, entry) => total + columnWidth / ratioOf(entry) + gap, 0);
  if (stack <= 0) return { repeat: 1, seconds: 1 };

  // The run has to reach past the bottom of the canvas on its own, or the
  // second copy would have to start before the first has finished passing.
  const repeat = Math.max(1, Math.ceil(canvasHeight / stack));
  return { repeat, seconds: (stack * repeat) / SPEED };
}
