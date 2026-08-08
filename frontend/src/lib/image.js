/*
 * Turning a chosen photograph into the one that is kept: a quarter turn, and a
 * rectangle of it. Everything here works in the *rotated frame* — the box the
 * photograph occupies once it has been turned — and a crop is normalised to it,
 * so the same numbers describe the picture on screen and the pixels on canvas.
 */

const QUALITY = 0.92;

/** The whole frame: nothing turned, nothing taken away. */
export const WHOLE = { x: 0, y: 0, w: 1, h: 1 };

/** The frame a photograph fills once turned — a quarter turn swaps its sides. */
export function frameOf(width, height, rotation) {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

/** A crop mirrored with the frame, so it keeps the same side of the subject. */
export function mirrorCrop(crop) {
  return { ...crop, x: 1 - (crop.x + crop.w) };
}

/** A crop carried through quarter turns clockwise, so it keeps its subject. */
export function turnCrop(crop, quarters) {
  const turns = ((quarters % 4) + 4) % 4;
  let box = crop;
  for (let i = 0; i < turns; i += 1) {
    box = { x: 1 - (box.y + box.h), y: box.x, w: box.h, h: box.w };
  }
  return box;
}

/** True while the photograph is still exactly the one that was handed over. */
export function isUntouched(rotation, crop, flipped = false) {
  return rotation === 0 && !flipped && crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1;
}

/** The kept photograph is always a JPEG, whatever arrived. */
export function jpegName(name) {
  const stem = (name || "sticker").replace(/\.[^.]+$/, "");
  return `${stem}.jpg`;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image failed to load"));
    image.src = src;
  });
}

/**
 * The edit, applied for real: the photograph turned, mirrored if it was asked
 * for, then cut to the crop, at its own resolution — the frame on screen is only
 * a preview of this.
 */
export async function renderEdit(src, { rotation = 0, crop = WHOLE, flipped = false } = {}, name) {
  const image = await loadImage(src);
  const source = { width: image.naturalWidth, height: image.naturalHeight };
  const frame = frameOf(source.width, source.height, rotation);
  const width = Math.max(1, Math.round(crop.w * frame.width));
  const height = Math.max(1, Math.round(crop.h * frame.height));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // A photograph with transparency would otherwise come out on black, and there
  // is no black anywhere in this archive.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  // Move the frame's origin to the corner of the crop, then draw the whole
  // photograph into the frame around its centre.
  ctx.translate(-crop.x * frame.width, -crop.y * frame.height);
  ctx.translate(frame.width / 2, frame.height / 2);
  // Mirrored across the frame's own upright axis, so a flip reads the same way
  // on screen whichever way the photograph has been turned.
  if (flipped) ctx.scale(-1, 1);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(image, -source.width / 2, -source.height / 2);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", QUALITY);
  });
  if (!blob) return null;
  return new File([blob], jpegName(name), { type: "image/jpeg" });
}
