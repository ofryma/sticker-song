import { Chip } from "@heroui/react";
import { imageUrl } from "../../lib/api.js";
import { useI18n } from "../../i18n/index.jsx";
import { Action } from "../ui/Action.jsx";

/** One candidate photograph in the duplicate comparison. */
export function DuplicateCard({ entry, mine, suggested, chosen, disabled, onChoose }) {
  const { t } = useI18n();
  const resolution =
    entry.image_width && entry.image_height
      ? t("duplicates.resolution", { w: entry.image_width, h: entry.image_height })
      : null;

  return (
    <li
      className={[
        "flex flex-col overflow-hidden rounded-sm border transition-colors duration-1200 ease-calm",
        chosen ? "border-olive/60 bg-olive-pale/70" : "border-day-line bg-day-soft/60",
      ].join(" ")}
    >
      <div className="relative aspect-[4/5] bg-day">
        <img
          src={imageUrl(entry)}
          alt={t("entry.photo", { name: entry.person_name })}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {/* A solid paper strip rather than a gradient: over a bright photograph a
            translucent label stops being readable. */}
        <span className="bg-day/92 text-ink-soft absolute inset-x-0 top-0 px-3 py-2 text-[0.6rem] tracking-widest uppercase backdrop-blur-sm">
          {mine ? t("duplicates.yours") : t("duplicates.existing")}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-serif text-base leading-snug text-ink">{entry.person_name}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-ink-muted">
          {resolution && <span className="font-mono">{resolution}</span>}
          <span>{entry.is_exact_match ? t("duplicates.exact") : t("duplicates.similar")}</span>
          {entry.vote_count > 0 && (
            <Chip
              size="sm"
              variant="flat"
              color="success"
              radius="sm"
              className="h-5 text-[0.6rem]"
            >
              {t("duplicates.votes", { n: entry.vote_count })}
            </Chip>
          )}
        </div>

        {suggested && (
          <p className="text-[0.65rem] leading-snug text-olive-deep">{t("duplicates.best")}</p>
        )}

        <Action
          tone={chosen ? "leaf" : "ghost"}
          size="sm"
          fullWidth
          className="mt-auto text-xs"
          onPress={() => onChoose(entry.id)}
          isDisabled={disabled}
        >
          {chosen ? t("duplicates.chosen") : t("duplicates.choose")}
        </Action>
      </div>
    </li>
  );
}
