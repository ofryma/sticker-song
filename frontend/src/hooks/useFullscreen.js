import { useEffect } from "react";

/*
 * The whole screen, where a browser gives it. The *document* goes full screen
 * rather than one element, so anything the page opens over the wall — a record,
 * its photograph — comes with it instead of being left behind on a hidden page.
 *
 * Nothing here is required for the full-screen wall to work: where the browser
 * refuses, iOS Safari among them, the wall still fills the window.
 */

/** True where the browser will hand the page the whole screen. */
export function fullscreenSupported() {
  return typeof document !== "undefined" && Boolean(document.documentElement?.requestFullscreen);
}

/** Ask for the screen. Called straight from a press, while the gesture counts. */
export function requestFullscreen() {
  if (!fullscreenSupported() || document.fullscreenElement) return;
  document.documentElement.requestFullscreen().catch(() => {});
}

/** Give the screen back, if we were holding it. */
export function exitFullscreen() {
  if (typeof document === "undefined" || !document.fullscreenElement) return;
  document.exitFullscreen?.()?.catch?.(() => {});
}

/**
 * Runs `onLeave` when the browser hands the screen back on its own — Escape, F11
 * or the system — so the page can put its own full-screen chrome away with it.
 */
export function useFullscreenExit(onLeave) {
  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) onLeave();
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [onLeave]);
}
