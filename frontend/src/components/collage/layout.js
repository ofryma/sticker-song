/**
 * Hand-placed slots for the collage, as percentages of the canvas. Overlaps are
 * deliberate — stickers in the street are pasted over each other — so `z` and
 * the slight rotations are art direction, not randomness.
 *
 * Each slot: x/y are the centre, w is width in % of canvas, r is rotation deg.
 */
const DESKTOP = [
  { x: 15, y: 26, w: 17, r: -2.5, z: 3 },
  { x: 33, y: 17, w: 14, r: 1.8, z: 5 },
  { x: 30, y: 46, w: 15, r: 2.6, z: 4 },
  { x: 50, y: 30, w: 18, r: -1.2, z: 6 },
  { x: 67, y: 19, w: 14, r: 2.2, z: 4 },
  { x: 70, y: 47, w: 16, r: -2.8, z: 5 },
  { x: 86, y: 30, w: 13, r: 1.5, z: 3 },
  { x: 12, y: 62, w: 14, r: 2.1, z: 2 },
  { x: 46, y: 66, w: 15, r: -1.9, z: 3 },
  { x: 88, y: 66, w: 14, r: -2.4, z: 2 },
  { x: 27, y: 82, w: 13, r: 1.4, z: 1 },
  { x: 63, y: 84, w: 14, r: 2.8, z: 1 },
];

const MOBILE = [
  { x: 29, y: 15, w: 40, r: -2.4, z: 3 },
  { x: 70, y: 27, w: 37, r: 2.2, z: 5 },
  { x: 33, y: 41, w: 42, r: 1.6, z: 4 },
  { x: 71, y: 57, w: 38, r: -2.8, z: 3 },
  { x: 30, y: 70, w: 39, r: 2.6, z: 2 },
  { x: 66, y: 86, w: 36, r: -1.8, z: 1 },
];

export function slotsFor(wide) {
  return wide ? DESKTOP : MOBILE;
}

/** Inline geometry for a slot. Percentages keep it fluid at any canvas size. */
export function slotStyle(slot) {
  return {
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    width: `${slot.w}%`,
    zIndex: slot.z,
    transform: `translate(-50%, -50%) rotate(${slot.r}deg)`,
  };
}

/**
 * How long a photograph stays before the next one takes its slot. Staggered by
 * slot so they never turn over together, and long enough to actually be read.
 */
export function dwellFor(index, wide) {
  const base = wide ? 9000 : 7500;
  return base + ((index * 1700) % 5200);
}
