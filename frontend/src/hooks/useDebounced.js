import { useEffect, useState } from "react";

/** A value that settles before it is used — a search box should not send a
 *  request per keystroke. */
export function useDebounced(value, delay = 300) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
