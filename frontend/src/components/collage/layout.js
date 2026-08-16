/**
 * Geometry for the collage, in pixels against the measured canvas.
 *
 * The wall is a lattice of cells — every sticker hangs straight and in line with
 * its neighbours, nothing is tilted — and each photograph is given close to the
 * same footprint as every other one rather than whatever its proportions happen
 * to claim. A tall sticker is shown narrower, a wide one shorter, so a long
 * portrait and a squat landscape read as the same size on the wall.
 *
 * Two things hold the wall together. The lattice is built for the number of
 * photographs actually on it, so a short archive spreads over the whole canvas
 * instead of bunching into the first corner, and a row with fewer stickers than
 * the rest is centred rather than left hanging at one edge. And every sticker is
 * kept inside its own cell, so neighbours sit shoulder to shoulder with a hair
 * of daylight between them and never cover one another.
 */

/* Stickers are mostly printed portrait; cells of the same shape pack closest. */
const TARGET_ASPECT = 0.8;

/* How many photographs are on the wall at once. */
const TILES = { wide: 18, narrow: 8 };

/* The share of its cell a sticker takes; the remainder is the gap between them. */
const FILL = 0.94;

/**
 * Rows and columns for a canvas of this shape holding `available` photographs.
 *
 * The count is capped at what the breakpoint asks for, and the columns are then
 * trimmed to what the rows actually need, so every cell in the lattice is used
 * and the cells come out near `TARGET_ASPECT` on a phone and a wide screen alike.
 */
export function gridFor(width, height, wide, available) {
  const count = Math.min(available, wide ? TILES.wide : TILES.narrow);
  if (width <= 0 || height <= 0 || count <= 0) {
    return { cols: 0, rows: 0, count: 0, width: 0, height: 0, cellW: 0, cellH: 0 };
  }

  const ideal = Math.round(Math.sqrt((count * width) / (TARGET_ASPECT * height)));
  const rows = Math.ceil(count / Math.min(count, Math.max(1, ideal)));
  // Trim back: with 7 photographs over 3 rows, 3 columns leave the lattice full
  // where the 4 the square root asked for would leave a column half empty.
  const cols = Math.ceil(count / rows);

  return { cols, rows, count, width, height, cellW: width / cols, cellH: height / rows };
}

/**
 * The centre of every cell, in pixels, read left to right and top to bottom.
 * A last row with fewer stickers than the rest is spread across the full width
 * so it stays centred under the others rather than starting at one edge.
 */
export function slotsFor(grid) {
  const slots = [];
  for (let row = 0; row < grid.rows; row += 1) {
    const inRow = Math.min(grid.cols, grid.count - row * grid.cols);
    if (inRow <= 0) break;
    const stride = grid.width / inRow;
    for (let col = 0; col < inRow; col += 1) {
      slots.push({ x: (col + 0.5) * stride, y: (row + 0.5) * grid.cellH });
    }
  }
  return slots;
}

/**
 * The width, in pixels, at which a sticker of these proportions covers about
 * the same area as every other sticker on the wall — held to whatever fits
 * inside its cell, so no photograph ever reaches over its neighbour. Height
 * follows from the ratio, so a photograph is never stretched or cropped.
 */
export function tileWidth(ratio, grid) {
  const even = Math.sqrt(grid.cellW * grid.cellH * ratio);
  return Math.min(even, grid.cellW, grid.cellH * ratio) * FILL;
}
