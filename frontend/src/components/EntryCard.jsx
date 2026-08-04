import { useState } from "react";
import { imageUrl } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import { useI18n } from "../i18n/index.jsx";

/**
 * One sticker on the wall. The photograph is shown whole and in full colour —
 * nothing dims it, nothing is written across it — and the name sits beneath it
 * on warm paper. On hover the image comes forward a hair rather than the card
 * lifting up.
 */
export function EntryCard({ entry, index = 0, onOpen }) {
  const { t, locale } = useI18n();
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="group border-day-line/80 bg-day-soft/80 hover:border-olive/45 duration-1200 ease-calm animate-rise block w-full overflow-hidden rounded-sm border text-start transition-colors"
      /* Staggered, but capped so a long page never crawls into view. */
      style={{ animationDelay: `${Math.min(index, 11) * 90}ms` }}
    >
      <div className="bg-day-warm relative aspect-[4/5] overflow-hidden">
        <img
          src={imageUrl(entry)}
          alt={t("entry.photo", { name: entry.person_name })}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={[
            "h-full w-full object-cover",
            "duration-2400 ease-calm transition-all",
            loaded ? "opacity-100 blur-0" : "opacity-0 blur-md",
            "group-hover:scale-[1.02]",
          ].join(" ")}
        />
      </div>

      <div className="p-4 sm:p-5">
        <h3 className="font-display text-ink text-lg leading-tight sm:text-xl">
          {entry.person_name}
        </h3>
        <p className="text-ink-muted mt-1.5 line-clamp-2 text-xs leading-relaxed">
          {entry.sticker_text}
        </p>
        <div className="text-ink-muted mt-3 flex items-center gap-3 text-[0.65rem] tracking-widest uppercase">
          <time dateTime={entry.created_at}>{formatDate(entry.created_at, locale)}</time>
          {entry.latitude != null && (
            <span aria-hidden="true" className="text-olive">
              ❧
            </span>
          )}
        </div>
        {/* A hairline that draws itself in under the name on hover. */}
        <span className="bg-olive/50 duration-1200 ease-calm mt-4 block h-px origin-left scale-x-0 transition-transform group-hover:scale-x-100 rtl:origin-right" />
      </div>
    </button>
  );
}
