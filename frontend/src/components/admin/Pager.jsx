import { Pagination } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";

/**
 * Where the reviewer is in the queue. The count is of everything the filters
 * match, not of what is on screen — the browser holds one page at a time.
 */
export function Pager({ page, pageSize, total, onChange }) {
  const { t } = useI18n();
  const pages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="border-day-line/70 mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-4">
      <p className="text-ink-muted text-xs tabular-nums">
        {t("admin.showing", { from, to, total })}
      </p>
      {pages > 1 && (
        <Pagination
          aria-label={t("admin.pages")}
          page={page + 1}
          total={pages}
          onChange={(next) => onChange(next - 1)}
          size="sm"
          radius="sm"
          variant="light"
          showControls
          classNames={{
            item: "text-ink-muted bg-transparent",
            cursor: "bg-day-warm text-ink shadow-none",
            next: "text-ink-muted bg-transparent",
            prev: "text-ink-muted bg-transparent",
          }}
        />
      )}
    </div>
  );
}
