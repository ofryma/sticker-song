import { useState } from "react";
import { Modal, ModalContent } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { Action } from "../ui/Action.jsx";
import { Glyph } from "../ui/Glyph.jsx";

/**
 * The photograph, kept beside the words. Once the sticker is off the screen a
 * visitor is writing from memory, so every later step carries it: a strip they
 * can read at a glance and open whole, and shut again in a moment.
 */
export function DraftPhoto({ preview }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (!preview) return null;

  return (
    <div className="mb-5 shrink-0 sm:mb-7">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 rounded-sm border border-day-line bg-day-soft/60 p-2 text-start transition-colors duration-700 ease-calm hover:border-ink/25 hover:bg-day-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tekhelet"
      >
        <img
          src={preview}
          alt={t("contribute.photoAlt")}
          className="h-16 w-16 shrink-0 rounded-sm border border-day-line/70 object-cover sm:h-20 sm:w-20"
        />
        <span className="min-w-0 flex-1">
          <span className="eyebrow block">{t("contribute.photoAside")}</span>
          <span className="mt-1 block text-xs text-ink-muted">{t("contribute.photoOpen")}</span>
        </span>
        <Glyph name="expand" className="me-1 h-5 w-5 shrink-0 text-ink-muted" />
      </button>

      <PhotoViewer preview={preview} isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}

/**
 * The same photograph, whole. Escape, the close button, or the photograph
 * itself all put it away — the visitor is in the middle of a sentence, and
 * getting back to it should not take a second thought.
 */
function PhotoViewer({ preview, isOpen, onClose }) {
  const { t } = useI18n();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      radius="sm"
      backdrop="opaque"
      placement="center"
      classNames={{
        backdrop: "bg-day/92",
        base: "bg-day-soft border border-day-line/80 m-0 max-h-full h-full rounded-none sm:h-auto sm:max-h-[92vh] sm:m-1 sm:rounded-sm",
        wrapper: "sm:p-6",
        closeButton: "hidden",
      }}
      /* Opening is unhurried; closing is not, on purpose — this is a glance
         back at the sticker, taken in the middle of writing. */
      motionProps={{
        variants: {
          enter: { opacity: 1, transition: { duration: 0.5, ease: [0.16, 0.8, 0.24, 1] } },
          exit: { opacity: 0, transition: { duration: 0.2, ease: "easeOut" } },
        },
      }}
    >
      <ModalContent>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 justify-end border-b border-day-line/70 px-2 py-1.5">
            <Action
              tone="quiet"
              isIconOnly
              size="sm"
              onPress={onClose}
              aria-label={t("contribute.photoClose")}
              title={t("contribute.photoClose")}
            >
              <Glyph name="cross" className="h-5 w-5" />
            </Action>
          </div>
          {/* The photograph closes it too: on a phone that is the whole screen,
              and the way out is wherever the thumb already is. */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("contribute.photoClose")}
            className="flex min-h-0 flex-1 items-center justify-center bg-day p-2"
          >
            <img
              src={preview}
              alt={t("contribute.photoAlt")}
              className="max-h-full w-full animate-fade object-contain sm:max-h-[78vh]"
            />
          </button>
        </div>
      </ModalContent>
    </Modal>
  );
}
