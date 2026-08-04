import { useI18n } from "../../i18n/index.jsx";

const TABS = ["pending", "published", "rejected"];

/** Which slice of the archive the reviewer is looking at, with its count. */
export function StatusTabs({ value, onChange, tally }) {
  const { t } = useI18n();

  return (
    <div
      role="tablist"
      aria-label={t("admin.queue")}
      className="flex flex-wrap items-center gap-x-7 gap-y-3 border-b border-day-line/70 pb-4"
    >
      {TABS.map((status) => {
        const active = status === value;
        return (
          <button
            key={status}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(status)}
            className={[
              "relative py-1 text-sm transition-colors duration-700 ease-calm",
              active ? "text-ink" : "text-ink-muted hover:text-ink",
              "after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-olive/70",
              "after:origin-center after:transition-transform after:duration-1200 after:ease-calm",
              active ? "after:scale-x-100" : "after:scale-x-0",
            ].join(" ")}
          >
            {t(`admin.status.${status}`)}
            {tally && <span className="ms-2 text-xs text-ink-muted">{tally[status] ?? 0}</span>}
          </button>
        );
      })}
    </div>
  );
}
