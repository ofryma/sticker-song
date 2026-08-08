import { useI18n } from "../../i18n/index.jsx";
import { formatDate } from "../../lib/format.js";
import { reviewImageUrl } from "../../lib/admin.js";
import { Action } from "../ui/Action.jsx";

/**
 * One sticker inside a conflict: the photograph whole and in colour, what it
 * carries, and the votes people gave it. Chosen means kept — everything else in
 * the group goes when the reviewer resolves.
 */
export function ConflictCandidate({ entry, token, chosen, suggested, onChoose }) {
  const { t, locale } = useI18n();

  return (
    <article
      className={[
        "rounded-sm border p-4 transition-colors duration-700 ease-calm",
        chosen ? "border-olive/60 bg-olive-pale/40" : "border-day-line bg-day-soft/50",
      ].join(" ")}
    >
      <div className="flex gap-4">
        <a
          href={reviewImageUrl({ token, id: entry.id, size: "image" })}
          target="_blank"
          rel="noreferrer"
          className="focus-visible:ring-tekhelet block w-28 shrink-0 focus-visible:ring-2 focus-visible:outline-none"
          title={t("admin.openFull")}
        >
          <img
            src={reviewImageUrl({ token, id: entry.id })}
            alt={t("entry.photo", { name: entry.person_name })}
            decoding="async"
            className="border-day-line bg-day-warm aspect-[4/5] w-full rounded-sm border object-cover"
          />
        </a>

        <div className="min-w-0 flex-1">
          <p className="text-ink-soft line-clamp-3 font-serif text-sm leading-relaxed break-words">
            {entry.sticker_text}
          </p>
          <dl className="text-ink-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <div>
              <dt className="sr-only">{t("admin.conflicts.col.votes")}</dt>
              <dd className="tabular-nums">
                {t("admin.conflicts.votes", { n: entry.vote_count })}
              </dd>
            </div>
            <div>
              <dt className="sr-only">{t("admin.resolution")}</dt>
              <dd>
                {entry.image_width}×{entry.image_height}
              </dd>
            </div>
            <div>
              <dt className="sr-only">{t("entry.added")}</dt>
              <dd>
                <time dateTime={entry.created_at}>{formatDate(entry.created_at, locale)}</time>
              </dd>
            </div>
            <div>
              <dt className="sr-only">{t("admin.col.status")}</dt>
              <dd>{t(`admin.status.${entry.status}`)}</dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Action
              tone={chosen ? "leaf" : "ghost"}
              size="sm"
              onPress={() => onChoose(entry.id)}
              isDisabled={chosen}
            >
              {chosen ? t("admin.conflicts.kept") : t("admin.conflicts.keep")}
            </Action>
            {suggested && (
              <span className="text-ink-muted text-xs">{t("admin.conflicts.suggested")}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
