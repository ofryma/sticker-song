import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/index.jsx";
import { exitFullscreen, useFullscreenExit } from "../hooks/useFullscreen.js";
import { Collage } from "./collage/Collage.jsx";
import { Action } from "./ui/Action.jsx";
import { Glyph } from "./ui/Glyph.jsx";

const FOCUSABLE = 'button, [href], [tabindex]:not([tabindex="-1"])';

/**
 * Tab stays on the stage while it is open. HeroUI does this for its modals; this
 * one is the page's own surface, so it keeps its own ring closed.
 */
function keepFocus(stage, event) {
  const items = [...stage.querySelectorAll(FOCUSABLE)].filter((node) => node.offsetParent !== null);
  if (items.length === 0) return;
  const [first, last] = [items[0], items[items.length - 1]];
  const here = document.activeElement;
  if (event.shiftKey && (here === first || here === stage)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && here === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * The wall, and nothing else: the drifting collage given the whole screen, with
 * every photograph still there to be opened. Mounted only while it is open, so
 * leaving it hands the screen back and returns the page as it was.
 */
export function WallStage({ entries, onOpen, onClose, onNeedMore }) {
  const { t } = useI18n();
  const stageRef = useRef(null);

  // Escape, F11 or the system leaving full screen closes the stage with it.
  useFullscreenExit(onClose);
  // Closing the stage any other way hands the screen back.
  useEffect(() => exitFullscreen, []);

  useEffect(() => {
    stageRef.current?.focus();
  }, []);

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    } else if (event.key === "Tab") {
      keepFocus(stageRef.current, event);
    }
  };

  return (
    <div
      ref={stageRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("wall.fullscreenTitle")}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex animate-fade flex-col bg-day focus:outline-none"
    >
      <div className="flex shrink-0 items-center justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
        <p className="eyebrow">{t("wall.title")}</p>
        <Action
          tone="quiet"
          size="sm"
          onPress={onClose}
          startContent={<Glyph name="cross" className="h-3.5 w-3.5" />}
        >
          {t("wall.exitFullscreen")}
        </Action>
      </div>

      <div className="min-h-0 flex-1 px-2 pb-2 sm:px-4 sm:pb-4">
        <Collage entries={entries} onOpen={onOpen} onNeedMore={onNeedMore} full />
      </div>
    </div>
  );
}
