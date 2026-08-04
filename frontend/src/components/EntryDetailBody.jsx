import { Link } from "@heroui/react";
import { useI18n } from "../i18n/index.jsx";

/** The written half of a record: the name, the transcription, and provenance. */
export function EntryDetailBody({ entry, coords, dateLabel, hebrewDate, mapHref, candle }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-7 p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:p-9">
      <div>
        <h2 className="font-display text-3xl leading-tight text-stone-50 sm:text-4xl">
          {entry.person_name}
        </h2>
        <hr className="rule-fade mt-5 max-w-40" />
      </div>

      <div>
        <p className="eyebrow mb-3">{t("entry.stickerText")}</p>
        <p className="font-serif text-lg leading-loose whitespace-pre-line text-stone-200">
          {entry.sticker_text}
        </p>
      </div>

      <div className="grid gap-5 text-sm sm:grid-cols-2">
        <div>
          <p className="eyebrow mb-2">{t("entry.added")}</p>
          <time dateTime={entry.created_at} className="block text-stone-300">
            {dateLabel}
          </time>
          {hebrewDate && <span className="text-xs text-stone-500">{hebrewDate}</span>}
        </div>
        <div>
          <p className="eyebrow mb-2">{t("entry.location")}</p>
          {coords && mapHref ? (
            <Link
              href={mapHref}
              isExternal
              size="sm"
              className="text-stone-300 underline decoration-stone-600 decoration-1 underline-offset-4 transition-colors duration-700 hover:text-flame-glow"
            >
              {coords}
              <span className="sr-only"> — {t("entry.openMap")}</span>
            </Link>
          ) : (
            <span className="text-stone-500">{t("entry.noLocation")}</span>
          )}
        </div>
      </div>

      {candle}
    </div>
  );
}
