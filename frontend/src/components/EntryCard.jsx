import { useState } from "react";
import { imageUrl } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import { useI18n } from "../i18n/index.jsx";

/**
 * One sticker on the wall. The photograph sits behind a permanent scrim so the
 * name always stays readable, and lightens slowly on hover — the image comes
 * forward rather than the card lifting up.
 */
export function EntryCard({ entry, index = 0, onOpen }) {
  const { t, locale } = useI18n();
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="group relative block w-full animate-rise overflow-hidden rounded-sm border border-night-line/70 bg-night-soft text-start
        transition-colors duration-1200 ease-memorial hover:border-stone-300/30"
      /* Staggered, but capped so a long page never crawls into view. */
      style={{ animationDelay: `${Math.min(index, 11) * 90}ms` }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-night">
        <img
          src={imageUrl(entry)}
          alt={t("entry.photo", { name: entry.person_name })}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={[
            "h-full w-full object-cover",
            "transition-all duration-2400 ease-memorial",
            loaded ? "opacity-100 blur-0" : "opacity-0 blur-md",
            "grayscale-[0.28] group-hover:grayscale-0 group-hover:scale-[1.03]",
          ].join(" ")}
        />
        {/* Light falls from above; the name sits in the dark at the bottom. */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night via-night/45 to-transparent
          transition-opacity duration-1800 ease-memorial group-hover:opacity-80"
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <h3 className="font-display text-lg leading-tight text-stone-50 sm:text-xl">
          {entry.person_name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-stone-300/80">
          {entry.sticker_text}
        </p>
        <div className="mt-3 flex items-center gap-3 text-[0.65rem] uppercase tracking-widest text-stone-400/70">
          <time dateTime={entry.created_at}>{formatDate(entry.created_at, locale)}</time>
          {entry.latitude != null && (
            <span aria-hidden="true" className="text-flame/60">
              ◈
            </span>
          )}
        </div>
        {/* A hairline that draws itself in under the name on hover. */}
        <span className="mt-4 block h-px origin-left scale-x-0 bg-flame/50 rtl:origin-right transition-transform duration-1200 ease-memorial group-hover:scale-x-100" />
      </div>
    </button>
  );
}
