import { useI18n } from "../../i18n/index.jsx";
import { Sprig } from "../Sprig.jsx";
import { Action } from "./Action.jsx";

/* The leaf is sized to the button so it reads as a mark, never as decoration. */
const LEAF = { sm: 11, md: 13, lg: 15 };

/**
 * The one call to action in the archive. It looks the same everywhere it
 * appears — the mark of the archive, the same three words, solid tekhelet — so
 * a visitor learns it once and then recognises it. Only the size changes with
 * the room it is standing in, and there is never more than one on a screen.
 *
 * Anything that wants a quieter way to `/contribute` is a link, not this.
 */
export function AddSticker({ size = "md", className = "", ...rest }) {
  const { t } = useI18n();

  return (
    <Action
      to="/contribute"
      size={size}
      className={className}
      startContent={<Sprig size={LEAF[size] ?? LEAF.md} tone="current" className="shrink-0" />}
      {...rest}
    >
      {t("nav.contribute")}
    </Action>
  );
}
