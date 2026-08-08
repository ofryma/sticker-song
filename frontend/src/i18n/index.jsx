import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import he from "./he.js";
import en from "./en.js";

const DICTS = { he, en };
const STORAGE_KEY = "memorial.lang";

const I18nContext = createContext(null);

function initialLang() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && DICTS[stored]) return stored;
  // Hebrew always opens the archive; the header toggle switches and remembers.
  return "he";
}

/** Resolve "a.b.c" against the dictionary, falling back to the key itself. */
function lookup(dict, path) {
  const value = path.split(".").reduce((node, part) => node?.[part], dict);
  return value === undefined ? path : value;
}

function interpolate(value, vars) {
  if (typeof value !== "string" || !vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] === undefined ? match : String(vars[name]),
  );
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(initialLang);
  const dict = DICTS[lang];
  const dir = dict.meta.dir;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang, dir]);

  const t = useCallback((path, vars) => interpolate(lookup(dict, path), vars), [dict]);

  const value = useMemo(
    () => ({
      lang,
      dir,
      dict,
      t,
      locale: dict.meta.locale,
      other: lang === "he" ? "en" : "he",
      otherName: DICTS[lang === "he" ? "en" : "he"].meta.name,
      setLang,
    }),
    [lang, dir, dict, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>");
  return context;
}
