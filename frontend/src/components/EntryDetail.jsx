import { Modal, ModalBody, ModalContent } from "@heroui/react";
import { imageUrl } from "../lib/api.js";
import { formatCoords, formatDate, formatHebrewDate, mapUrl } from "../lib/format.js";
import { useI18n } from "../i18n/index.jsx";
import { useCandles } from "../hooks/useCandles.js";
import { Candle } from "./Candle.jsx";
import { Action } from "./ui/Action.jsx";
import { EntryDetailBody } from "./EntryDetailBody.jsx";

function Arrow({ label, onPress, flip }) {
  if (!onPress) return null;
  return (
    <Action tone="quiet" isIconOnly size="sm" onPress={onPress} aria-label={label}>
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${flip ? "rotate-180" : ""}`} fill="none">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </Action>
  );
}

/**
 * One record, full size. HeroUI's Modal handles focus trapping, scroll locking
 * and the backdrop; arrow keys walk the list in reading order.
 */
export function EntryDetail({ entry, onClose, onPrev, onNext }) {
  const { t, lang, locale } = useI18n();
  const { isLit, light } = useCandles();

  const open = Boolean(entry);
  const lit = open && isLit(entry.id);

  const onKeyDown = (event) => {
    // Arrows follow reading order, so they flip with the document direction.
    const rtl = document.documentElement.dir === "rtl";
    if (event.key === "ArrowLeft") (rtl ? onNext : onPrev)?.();
    if (event.key === "ArrowRight") (rtl ? onPrev : onNext)?.();
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
      radius="sm"
      backdrop="blur"
      // Full-screen sheet on a phone, centered dialog from `sm` up.
      placement="center"
      classNames={{
        backdrop: "bg-night/92",
        base: "bg-night-soft border border-night-line/80 m-0 max-h-full h-full rounded-none sm:h-auto sm:max-h-[92vh] sm:m-1 sm:rounded-sm",
        wrapper: "sm:p-6",
        body: "p-0",
        closeButton: "hidden",
      }}
      motionProps={{
        variants: {
          enter: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 0.8, 0.24, 1] } },
          exit: { opacity: 0, y: 24, transition: { duration: 0.5, ease: "easeOut" } },
        },
      }}
    >
      <ModalContent onKeyDown={onKeyDown}>
        {entry && (
          <ModalBody>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-night-line/70 bg-night-soft/95 px-2 py-1.5 backdrop-blur-sm">
              <div className="flex items-center gap-1">
                <Arrow label={t("entry.prev")} onPress={onPrev} />
                <Arrow label={t("entry.next")} onPress={onNext} flip />
              </div>
              <Action
                tone="quiet"
                isIconOnly
                size="sm"
                onPress={onClose}
                aria-label={t("entry.close")}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </Action>
            </div>

            <div className="grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
              <div className="bg-night md:border-e md:border-night-line/70">
                <img
                  src={imageUrl(entry)}
                  alt={t("entry.photo", { name: entry.person_name })}
                  className="max-h-[52svh] w-full animate-fade object-contain sm:max-h-[68vh]"
                />
              </div>

              <EntryDetailBody
                entry={entry}
                coords={formatCoords(entry.latitude, entry.longitude)}
                dateLabel={formatDate(entry.created_at, locale)}
                hebrewDate={lang === "he" ? formatHebrewDate(entry.created_at) : null}
                mapHref={entry.latitude != null ? mapUrl(entry.latitude, entry.longitude) : null}
                candle={
                  <Action
                    tone={lit ? "candle" : "ghost"}
                    onPress={() => light(entry.id)}
                    isDisabled={lit}
                    className="mt-auto w-full disabled:opacity-100 sm:w-auto"
                    startContent={<Candle size={13} lit={lit} />}
                  >
                    {lit ? t("entry.candleLit") : t("entry.candle")}
                  </Action>
                }
              />
            </div>
          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
}
