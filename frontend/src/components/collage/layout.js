/**
 * Cells for the collage, as percentages of the canvas. An even lattice — every
 * sticker hangs straight and lines up with its neighbours, nothing overlaps and
 * nothing is tilted; the only movement is a photograph giving up its cell to the
 * next name in the archive.
 *
 * Each cell: x/y are its centre, w/h its size, all in % of the canvas. A sticker
 * is fitted inside its cell at its own proportions rather than cropped to fill
 * it, so the cell only ever bounds it.
 */
function lattice(cols, rows, gap) {
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({
        x: ((col + 0.5) / cols) * 100,
        y: ((row + 0.5) / rows) * 100,
        w: 100 / cols - gap,
        h: 100 / rows - gap,
      });
    }
  }
  return cells;
}

const DESKTOP = lattice(4, 3, 4);
const MOBILE = lattice(2, 3, 6);

export function slotsFor(wide) {
  return wide ? DESKTOP : MOBILE;
}

/** Inline geometry for a cell. Percentages keep it fluid at any canvas size. */
export function slotStyle(slot) {
  return {
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    width: `${slot.w}%`,
    height: `${slot.h}%`,
    transform: "translate(-50%, -50%)",
  };
}

/**
 * Width of a sticker of the given proportions inside its cell: as wide as the
 * cell allows, unless its own height would run past the cell first — the cell is
 * a size container, so `cqh` is its height whatever the canvas turns out to be.
 * Height then follows from the ratio, so nothing is stretched or cropped.
 */
export function fitWidth(ratio) {
  return `min(100%, calc(100cqh * ${ratio.toFixed(4)}))`;
}

/**
 * How long a photograph stays before the next one takes its cell. Staggered by
 * cell so they never turn over together, and long enough to actually be read.
 */
export function dwellFor(index, wide) {
  const base = wide ? 9000 : 7500;
  return base + ((index * 1700) % 5200);
}
