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

/** Case-insensitive match across the two text fields we hold. */
export function matchesQuery(entry, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    entry.person_name.toLowerCase().includes(needle) ||
    entry.sticker_text.toLowerCase().includes(needle)
  );
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
