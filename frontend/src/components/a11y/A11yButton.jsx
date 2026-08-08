import { useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { useA11y } from "../../hooks/useA11y.js";
import { Action } from "../ui/Action.jsx";
import { Glyph } from "../ui/Glyph.jsx";
import { A11yPanel } from "./A11yPanel.jsx";

/**
 * The accessibility control: one fixed button on every page, opening the display
 * preferences. It sits on the starting edge, so it flips with the language, and
 * above the mobile bottom bar rather than over it.
 */
export function A11yButton() {
  const { t } = useI18n();
  const a11y = useA11y();
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] start-3 z-40 sm:bottom-5 sm:start-5">
        <Action
          tone="ghost"
          isIconOnly
          onPress={() => setOpen(true)}
          aria-label={t("a11y.open")}
          aria-haspopup="dialog"
          className="h-11 w-11 bg-day-soft/90 shadow-sm backdrop-blur-sm"
        >
          <Glyph name="access" className="h-5 w-5" />
        </Action>
      </div>

      <A11yPanel isOpen={isOpen} onClose={() => setOpen(false)} {...a11y} />
    </>
  );
}
