/**
 * Geometry for the collage, in pixels against the measured canvas.
 *
 * The wall is a close lattice of cells — every sticker still hangs straight and
 * in line with its neighbours, nothing is tilted — but each photograph is given
 * the same footprint as every other one rather than whatever its proportions
 * happen to claim. A tall sticker is shown narrower, a wide one shorter, so a
 * long portrait and a squat landscape read as the same size on the wall.
 *
 * Because they share a footprint, stickers sit a little larger than their cell
 * and just touch or overlap their neighbours, which is what makes the wall look
 * pasted up rather than laid out.
 */

/* Stickers are mostly printed portrait; cells of the same shape pack closest. */
const TARGET_ASPECT = 0.8;

/* How many photographs are on the wall at once. */
const TILES = { wide: 18, narrow: 8 };

/* Each sticker's footprint, as a multiple of its cell — above 1 they overlap. */
const DENSITY = 1.16;

/* However extreme its proportions, no sticker runs further past its cell. */
const MAX_OVERHANG = 1.3;

/**
 * Rows and columns for a canvas of this shape. Chosen so cells come out near
 * `TARGET_ASPECT` while holding roughly the intended number of tiles, which
 * keeps the lattice tight on a phone and on a wide screen alike.
 */
export function gridFor(width, height, wide) {
  const count = wide ? TILES.wide : TILES.narrow;
  if (width <= 0 || height <= 0) return { cols: 0, rows: 0, cellW: 0, cellH: 0 };

  const cols = Math.max(2, Math.round(Math.sqrt((count * width) / (TARGET_ASPECT * height))));
  const rows = Math.max(2, Math.round(count / cols));
  return { cols, rows, cellW: width / cols, cellH: height / rows };
}

/** The centre of every cell, in pixels, read left to right and top to bottom. */
export function slotsFor(grid) {
  const slots = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      slots.push({ x: (col + 0.5) * grid.cellW, y: (row + 0.5) * grid.cellH });
    }
  }
  return slots;
}

/**
 * The width, in pixels, at which a sticker of these proportions covers the same
 * area as every other sticker on the wall. Height follows from the ratio, so a
 * photograph is never stretched or cropped — only scaled.
 */
export function tileWidth(ratio, grid) {
  const area = grid.cellW * grid.cellH * DENSITY;
  const width = Math.sqrt(area * ratio);

  // Extreme proportions would otherwise reach across two neighbours; hold them
  // to the overhang and let those few sit a little smaller than the rest.
  const excess = Math.max(
    width / (grid.cellW * MAX_OVERHANG),
    width / ratio / (grid.cellH * MAX_OVERHANG),
    1,
  );

  return width / excess;
}
