/** Formatting helpers. No React, no side effects. */

export function formatDate(iso, locale) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Hebrew date, when the locale is Hebrew — a memorial reads better with it. */
export function formatHebrewDate(iso) {
  try {
    return new Intl.DateTimeFormat("he-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

/** Compact date for a dense list, where the long form would crowd the row. */
export function formatShortDate(iso, locale) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).format(new Date(iso));
}

export function formatCoords(lat, lon) {
  if (lat == null || lon == null) return null;
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lon).toFixed(4)}°${ew}`;
}

export function mapUrl(lat, lon) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}

export function pluralCount(t, base, n) {
  if (n === 0) return t(`${base}None`, { n });
  if (n === 1) return t(`${base}One`, { n });
  return t(`${base}Many`, { n });
}

/**
 * A sticker's own proportions, width over height. Older records without measured
 * dimensions fall back to a portrait shape, which is how most stickers are
 * printed.
 */
export function ratioOf(entry) {
  const { image_width: w, image_height: h } = entry;
  return w > 0 && h > 0 ? w / h : 0.8;
}

/** Case-insensitive match across the two text fields we hold. */
export function matchesQuery(entry, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    entry.person_name.toLowerCase().includes(needle) ||
    entry.sticker_text.toLowerCase().includes(needle)
  );
}
