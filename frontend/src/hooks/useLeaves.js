import { useCallback, useState } from "react";

const STORAGE_KEY = "stickers.leaves";

function read() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

/**
 * Leaves a visitor has added — one per person, a way of saying "I stopped here
 * and I remember them". Deliberately local to the device: a private gesture,
 * never a public counter, and never sent anywhere.
 */
export function useLeaves() {
  const [added, setAdded] = useState(read);

  const add = useCallback((id) => {
    setAdded((current) => {
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

  return { hasLeaf: useCallback((id) => added.has(id), [added]), add };
}
