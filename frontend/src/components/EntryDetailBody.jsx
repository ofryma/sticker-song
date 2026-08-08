import { Link } from "@heroui/react";
import { useI18n } from "../i18n/index.jsx";

/** The written half of a record: the name, the transcription, and provenance. */
export function EntryDetailBody({
  entry,
  coords,
  dateLabel,
  hebrewDate,
  mapHref,
  gesture,
  report,
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-7 p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:p-9">
      <div>
        <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          {entry.person_name}
        </h2>
        <hr className="rule-fade mt-5 max-w-40" />
      </div>

      <div>
        <p className="eyebrow mb-3">{t("entry.stickerText")}</p>
        <p className="font-serif text-lg leading-loose whitespace-pre-line text-ink">
          {entry.sticker_text}
        </p>
      </div>

      <div className="grid gap-5 text-sm sm:grid-cols-2">
        <div>
          <p className="eyebrow mb-2">{t("entry.added")}</p>
          <time dateTime={entry.created_at} className="block text-ink-soft">
            {dateLabel}
          </time>
          {hebrewDate && <span className="text-xs text-ink-muted">{hebrewDate}</span>}
        </div>
        <div>
          <p className="eyebrow mb-2">{t("entry.location")}</p>
          {coords && mapHref ? (
            <Link
              href={mapHref}
              isExternal
              size="sm"
              className="text-ink-soft decoration-ink-faint hover:text-tekhelet-deep underline decoration-1 underline-offset-4 transition-colors duration-700"
            >
              {coords}
              <span className="sr-only"> — {t("entry.openMap")}</span>
            </Link>
          ) : (
            <span className="text-ink-muted">{t("entry.noLocation")}</span>
          )}
        </div>
      </div>

      {/* The gesture, and one line saying what it is — a leaf means nothing on
          its own, and nobody should have to guess before they give one. */}
      <div className="mt-auto flex flex-col gap-2.5">
        {gesture}
        <p className="text-ink-muted max-w-xs text-xs leading-relaxed">{t("entry.leafHint")}</p>
        {/* Quiet on purpose: a way to put something right, not an invitation to
            find fault with a record somebody made. */}
        {report}
      </div>
    </div>
  );
}
