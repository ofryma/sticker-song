import { thumbUrl } from "../../lib/api.js";
import { useI18n } from "../../i18n/index.jsx";

/**
 * One sticker the archive already holds under this name, to be read rather than
 * acted on — the photograph whole and in colour, the name and words on paper
 * beneath it, exactly as the wall shows them.
 */
export function MatchCard({ entry }) {
  const { t } = useI18n();

  return (
    <li className="flex flex-col overflow-hidden rounded-sm border border-day-line bg-day-soft/60">
      <div className="aspect-[4/5] bg-day">
        <img
          src={thumbUrl(entry)}
          alt={t("entry.photo", { name: entry.person_name })}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-serif text-base leading-snug text-ink">{entry.person_name}</p>
        {entry.sticker_text && (
          <p className="line-clamp-3 font-serif text-xs leading-relaxed text-ink-muted">
            {entry.sticker_text}
          </p>
        )}
        <p className="mt-auto text-[0.65rem] tracking-label text-ink-muted uppercase">
          {entry.is_exact_match ? t("duplicates.exact") : t("duplicates.similar")}
        </p>
      </div>
    </li>
  );
}
