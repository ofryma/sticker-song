import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The rendered size of an element, in pixels, kept in step with the browser.
 *
 * For the few layouts that cannot be expressed in CSS alone — the collage sizes
 * every sticker to the same footprint, which needs the canvas's real width *and*
 * height at once. Returns `{ width, height }`, both 0 until the first measure.
 */
export function useMeasure() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const node = useRef(null);

  const ref = useCallback((element) => {
    node.current = element;
    if (element) {
      const box = element.getBoundingClientRect();
      setSize({ width: box.width, height: box.height });
    }
  }, []);

  useEffect(() => {
    const element = node.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize((current) =>
        current.width === box.width && current.height === box.height
          ? current
          : { width: box.width, height: box.height },
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
