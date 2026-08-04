import { HeroUIProvider } from "@heroui/react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../i18n/index.jsx";
import en from "../i18n/en.js";

const STORAGE_KEY = "memorial.lang";

/** The dictionary the tests assert against, so no UI string is duplicated. */
export { en as dict };

/** Resolve a dotted key the way `t()` does, for use in an assertion. */
export function text(path, vars) {
  const value = path.split(".").reduce((node, part) => node?.[part], en);
  if (typeof value !== "string" || !vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] === undefined ? match : String(vars[name]),
  );
}

function Providers({ children }) {
  return (
    <I18nProvider>
      <MemoryRouter>
        <HeroUIProvider>{children}</HeroUIProvider>
      </MemoryRouter>
    </I18nProvider>
  );
}

/**
 * Render inside the providers the app itself uses. English, because the
 * assertions read better in it; the provider picks the language up from storage
 * exactly as it does in a browser.
 */
export function renderApp(ui, options) {
  localStorage.setItem(STORAGE_KEY, "en");
  return render(ui, { wrapper: Providers, ...options });
}
