import { useEffect, useRef } from "react";
import { thumbUrl } from "../lib/api.js";

/**
 * Warms the browser cache with the photographs the collage is about to turn to.
 *
 * A tile crossfades over 2.2s; without this the incoming photograph starts its
 * fade as an empty rectangle and only arrives partway through. Fetching a few
 * ahead of the cursor keeps the wall unhurried on a large archive without
 * pulling the whole thing down at once.
 */
export function usePrefetchThumbs(entries, cursor, ahead = 6) {
  const seen = useRef(new Set());

  useEffect(() => {
    if (entries.length === 0) return;
    for (let step = 0; step < ahead; step += 1) {
      const entry = entries[(cursor + step) % entries.length];
      if (!entry || seen.current.has(entry.id)) continue;
      seen.current.add(entry.id);
      const image = new Image();
      image.decoding = "async";
      image.src = thumbUrl(entry);
    }
  }, [entries, cursor, ahead]);
}
