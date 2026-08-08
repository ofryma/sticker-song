import { useState } from "react";
import { thumbUrl } from "../lib/api.js";
import { ratioOf } from "../lib/format.js";
import { useI18n } from "../i18n/index.jsx";

/**
 * A sticker as it was photographed: whole, in colour, at its own proportions —
 * no frame, no crop, no paper around it. The name rests on a small strip of
 * parchment in the lower corner, inside the photograph, clear of the face.
 */
export function Sticker({ entry, className = "", imageClassName = "", style }) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState(false);

  return (
    <figure
      className={`bg-day-warm relative overflow-hidden rounded-sm ${className}`}
      style={{ aspectRatio: ratioOf(entry), ...style }}
    >
      <img
        src={thumbUrl(entry)}
        alt={t("entry.photo", { name: entry.person_name })}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={[
          "h-full w-full object-cover",
          "duration-2400 ease-calm transition-all",
          loaded ? "opacity-100 blur-0" : "opacity-0 blur-md",
          imageClassName,
        ].join(" ")}
      />
      <figcaption
        className="bg-day/90 text-ink absolute bottom-0 start-0 max-w-[85%] truncate rounded-se-sm
          px-2 py-1 font-serif text-[0.7rem] leading-tight sm:text-xs"
      >
        {entry.person_name}
      </figcaption>
    </figure>
  );
}
