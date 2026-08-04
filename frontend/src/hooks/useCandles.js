import { useCallback, useState } from "react";

const STORAGE_KEY = "memorial.candles";

function read() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

/**
 * Candles a visitor has lit. Deliberately local to the device: this is a
 * private gesture, not a public counter, and it is never sent anywhere.
 */
export function useCandles() {
  const [lit, setLit] = useState(read);

  const light = useCallback((id) => {
    setLit((current) => {
      if (current.has(id)) return current;
      const next = new Set(current).add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // A full or blocked storage must not break the page.
      }
      return next;
    });
  }, []);

  return { isLit: useCallback((id) => lit.has(id), [lit]), light };
}
