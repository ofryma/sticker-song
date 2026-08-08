import { useCallback, useSyncExternalStore } from "react";

/* Tailwind's `sm`. Anything narrower is held to be a phone. */
const SM = "(min-width: 640px)";

/**
 * True while the viewport is at least `query` wide, for the few decisions CSS
 * cannot make on its own — where a button has to *do* something different on a
 * phone rather than merely look different.
 */
export function useWide(query = SM) {
  // Read straight from the media query instead of mirroring it into state: the
  // value stays in step with the browser with no setState on mount.
  const subscribe = useCallback(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );

  const snapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
