import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "memorial.a11y";

/* Text has three steps rather than a slider: a visitor picks a size once and it
   stays. The values are root font sizes, and everything is sized in rem. */
export const TEXT_STEPS = 3;

export const DEFAULTS = {
  text: 0,
  contrast: false,
  links: false,
  stillness: false,
  plainFont: false,
};

/** The switches, in the order they are shown. `text` has its own control. */
export const A11Y_FLAGS = ["contrast", "links", "stillness", "plainFont"];

const ATTRIBUTES = {
  contrast: "a11yContrast",
  links: "a11yLinks",
  stillness: "a11yStillness",
  plainFont: "a11yFont",
};

function read() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return stored && typeof stored === "object" ? { ...DEFAULTS, ...stored } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/**
 * The visitor's display preferences. They live on <html> as data attributes —
 * `src/a11y.css` and `src/tokens.css` do the rest — and are kept on the device,
 * never sent anywhere.
 */
export function useA11y() {
  const [settings, setSettings] = useState(read);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.a11yText = String(settings.text);
    for (const [flag, attribute] of Object.entries(ATTRIBUTES)) {
      if (settings[flag]) root.dataset[attribute] = "on";
      else delete root.dataset[attribute];
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // A device that refuses storage still gets the settings for this visit.
    }
  }, [settings]);

  const toggle = useCallback(
    (flag) => setSettings((prev) => ({ ...prev, [flag]: !prev[flag] })),
    [],
  );

  const setText = useCallback((text) => setSettings((prev) => ({ ...prev, text })), []);

  const reset = useCallback(() => setSettings(DEFAULTS), []);

  const changed = A11Y_FLAGS.some((flag) => settings[flag]) || settings.text !== 0;

  return { settings, toggle, setText, reset, changed };
}
