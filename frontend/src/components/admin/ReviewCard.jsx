import { useState } from "react";
import { Textarea } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { formatCoords, formatDate, mapUrl } from "../../lib/format.js";
import { reviewImageUrl } from "../../lib/admin.js";
import { Action } from "../ui/Action.jsx";
import { LlmNote } from "./LlmNote.jsx";

/**
 * One submission, as a reviewer needs to see it: the photograph whole and in
 * colour, the name and the transcription exactly as typed, and the decision.
 */
export function ReviewCard({ entry, token, busy, onAct, onReanalyze }) {
  const { t, locale } = useI18n();
  const [note, setNote] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const pending = entry.status === "pending";
  const coords = formatCoords(entry.latitude, entry.longitude);

  return (
    <article className="border-day-line/80 bg-day-soft/70 animate-rise overflow-hidden rounded-sm border">
      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:p-6">
        <a
          href={reviewImageUrl({ token, id: entry.id, size: "image" })}
          target="_blank"
          rel="noreferrer"
          className="focus-visible:ring-tekhelet block w-full shrink-0 focus-visible:ring-2 focus-visible:outline-none sm:w-56"
          title={t("admin.openFull")}
        >
          <img
            src={reviewImageUrl({ token, id: entry.id })}
            alt={t("entry.photo", { name: entry.person_name })}
            loading="lazy"
            decoding="async"
            className="border-day-line bg-day-warm aspect-[4/5] w-full rounded-sm border object-cover"
          />
        </a>

        <div className="min-w-0 flex-1">
          <h2 className="text-ink font-serif text-2xl leading-tight break-words">
            {entry.person_name}
          </h2>
          <p className="text-ink-soft mt-3 font-serif text-sm leading-loose whitespace-pre-line break-words">
            {entry.sticker_text}
          </p>

          <dl className="text-ink-muted mt-5 flex flex-wrap gap-x-6 gap-y-1 text-xs">
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

          <div className="mt-5">
            <LlmNote entry={entry} onReanalyze={() => onReanalyze(entry.id)} busy={busy} />
          </div>

          {entry.review_note && !pending && (
            <p className="text-ink-muted mt-4 text-xs leading-relaxed">
              {t("admin.decidedNote", { note: entry.review_note })}
            </p>
          )}
        </div>
      </div>

      <div className="border-day-line/70 bg-day/60 border-t px-5 py-4 sm:px-6">
        {pending && (
          <Textarea
            value={note}
            onValueChange={setNote}
            aria-label={t("admin.noteLabel")}
            placeholder={t("admin.notePlaceholder")}
            minRows={1}
            maxRows={4}
            radius="sm"
            variant="bordered"
            classNames={{
              input: "text-sm",
              inputWrapper: "border-day-line bg-day-soft/70",
            }}
          />
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {pending && (
            <>
              <Action
                tone="leaf"
                size="sm"
                isLoading={busy}
                onPress={() => onAct("publish", entry.id, note)}
              >
                {t("admin.publish")}
              </Action>
              <Action
                tone="ghost"
                size="sm"
                isDisabled={busy}
                onPress={() => onAct("reject", entry.id, note)}
              >
                {t("admin.reject")}
              </Action>
            </>
          )}
          {!pending && entry.status === "rejected" && (
            <Action
              tone="leaf"
              size="sm"
              isLoading={busy}
              onPress={() => onAct("publish", entry.id, "")}
            >
              {t("admin.publishAnyway")}
            </Action>
          )}
          {!pending && entry.status === "published" && (
            <Action
              tone="ghost"
              size="sm"
              isDisabled={busy}
              onPress={() => onAct("reject", entry.id, "")}
            >
              {t("admin.takeOffWall")}
            </Action>
          )}

          {/* Two steps rather than a dialog: this one has no undo. */}
          <div className="ms-auto flex items-center gap-3">
            {confirmingDelete ? (
              <>
                <span className="text-sun-deep text-xs">{t("admin.deleteWarning")}</span>
                <Action
                  tone="quiet"
                  size="sm"
                  isLoading={busy}
                  onPress={() => onAct("delete", entry.id)}
                  className="text-sun-deep"
                >
                  {t("admin.deleteConfirm")}
                </Action>
                <Action tone="quiet" size="sm" onPress={() => setConfirmingDelete(false)}>
                  {t("admin.cancel")}
                </Action>
              </>
            ) : (
              <Action tone="quiet" size="sm" onPress={() => setConfirmingDelete(true)}>
                {t("admin.delete")}
              </Action>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
