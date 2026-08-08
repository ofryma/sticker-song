import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { formatCoords, formatDate, mapUrl } from "../../lib/format.js";
import { reviewImageUrl } from "../../lib/admin.js";
import { DecisionBar } from "./DecisionBar.jsx";
import { LlmNote } from "./LlmNote.jsx";

/**
 * One submission in full, opened from a row. The drawer's contents mount only
 * while it is open, so a photograph is fetched when a reviewer asks for it and
 * not thirty at a time on the way past.
 *
 * The photograph is shown whole and in colour, the name and the transcription
 * exactly as they were typed.
 */
export function ReviewDrawer({ entry, token, busy, onClose, onAct, onReanalyze }) {
  const { t, locale } = useI18n();
  const coords = entry ? formatCoords(entry.latitude, entry.longitude) : null;

  return (
    <Drawer
      isOpen={Boolean(entry)}
      onOpenChange={(open) => !open && onClose()}
      placement="right"
      size="lg"
      radius="none"
      // A working panel, not a dialog: the queue stays visible and scrollable
      // beside it, and the motion is short enough to stay out of the way. The
      // unhurried timings this project uses elsewhere are for visitors.
      backdrop="transparent"
      shouldBlockScroll={false}
      classNames={{
        base: "bg-day border-s border-day-line shadow-lg",
        closeButton: "text-ink-muted top-4 end-4",
      }}
      motionProps={{
        variants: {
          enter: { opacity: 1, x: 0, transition: { duration: 0.18, ease: "easeOut" } },
          exit: { opacity: 0, x: 24, transition: { duration: 0.12, ease: "easeOut" } },
        },
      }}
    >
      <DrawerContent>
        {entry && (
          <>
            <DrawerHeader className="border-day-line/70 bg-day-soft/70 flex-col items-start gap-1 border-b">
              <p className="eyebrow">{t(`admin.status.${entry.status}`)}</p>
              <h2 className="text-ink font-serif text-2xl leading-tight break-words">
                {entry.person_name}
              </h2>
            </DrawerHeader>

            <DrawerBody className="gap-6 py-6">
              <a
                href={reviewImageUrl({ token, id: entry.id, size: "image" })}
                target="_blank"
                rel="noreferrer"
                className="focus-visible:ring-tekhelet block focus-visible:ring-2 focus-visible:outline-none"
                title={t("admin.openFull")}
              >
                <img
                  src={reviewImageUrl({ token, id: entry.id })}
                  alt={t("entry.photo", { name: entry.person_name })}
                  decoding="async"
                  className="border-day-line bg-day-warm w-full rounded-sm border object-contain"
                />
              </a>

              <p className="text-ink-soft font-serif text-base leading-loose whitespace-pre-line break-words">
                {entry.sticker_text}
              </p>

              <dl className="text-ink-muted flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <div>
                  <dt className="sr-only">{t("entry.added")}</dt>
                  <dd>
                    <time dateTime={entry.created_at}>{formatDate(entry.created_at, locale)}</time>
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">{t("entry.location")}</dt>
                  <dd>
                    {coords ? (
                      <a
                        href={mapUrl(entry.latitude, entry.longitude)}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-ink transition-colors duration-700"
                      >
                        {coords}
                      </a>
                    ) : (
                      t("entry.noLocation")
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">{t("admin.resolution")}</dt>
                  <dd>
                    {entry.image_width}×{entry.image_height}
                  </dd>
                </div>
              </dl>

              <LlmNote entry={entry} onReanalyze={() => onReanalyze(entry.id)} busy={busy} />

              {entry.review_note && entry.status !== "pending" && (
                <p className="text-ink-muted text-xs leading-relaxed">
                  {t("admin.decidedNote", { note: entry.review_note })}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter className="border-day-line/70 bg-day-soft/60 border-t">
              <DecisionBar key={entry.id} entry={entry} busy={busy} onAct={onAct} />
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
