import { Select, SelectItem, Tab, Tabs } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { PERIODS, READS } from "../../lib/review.js";
import { SearchField } from "../SearchField.jsx";

const STATUSES = ["pending", "published", "rejected", "all"];

/** A compact single-choice filter, styled once for the whole bar. */
function Choice({ label, value, options, onChange }) {
  return (
    <Select
      aria-label={label}
      selectedKeys={[value]}
      onSelectionChange={(keys) => onChange([...keys][0] ?? "any")}
      disallowEmptySelection
      size="sm"
      radius="sm"
      variant="bordered"
      className="w-36"
      classNames={{
        trigger: "border-day-line bg-day-soft/70 h-9 min-h-9",
        value: "text-ink-soft text-sm",
        popoverContent: "bg-day border border-day-line rounded-sm",
      }}
    >
      {options.map((option) => (
        <SelectItem key={option.key}>{option.label}</SelectItem>
      ))}
    </Select>
  );
}

/**
 * Every filter the reviewer has, on one line: which slice of the archive, when
 * it was added, what the automatic reader thought, and a free-text search over
 * the name and the transcription. Only the slice is asked of the backend; the
 * rest narrow the rows already in hand.
 */
export function FilterBar({ status, onStatusChange, filters, onFilterChange, tally }) {
  const { t } = useI18n();
  const countOf = (key) =>
    !tally ? null : key === "all" ? tally.pending + tally.published + tally.rejected : tally[key];
  const options = (base, keys) => keys.map((key) => ({ key, label: t(`admin.${base}.${key}`) }));

  return (
    <div className="border-day-line/70 flex flex-col gap-4 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
      <Tabs
        aria-label={t("admin.queue")}
        selectedKey={status}
        onSelectionChange={(key) => onStatusChange(String(key))}
        variant="light"
        radius="sm"
        classNames={{
          tabList: "gap-1 p-0",
          cursor: "bg-day-warm/80 shadow-none",
          tab: "h-9 px-3 data-[hover-unselected=true]:opacity-100",
          tabContent: "text-ink-muted group-data-[selected=true]:text-ink text-sm",
        }}
      >
        {STATUSES.map((key) => (
          <Tab
            key={key}
            title={
              <span className="flex items-center gap-2">
                {t(`admin.status.${key}`)}
                {countOf(key) != null && (
                  <span className="text-ink-faint text-xs tabular-nums">{countOf(key)}</span>
                )}
              </span>
            }
          />
        ))}
      </Tabs>

      <div className="flex flex-wrap items-center gap-3">
        <Choice
          label={t("admin.filter.added")}
          value={filters.period}
          options={options("period", PERIODS)}
          onChange={(period) => onFilterChange({ period })}
        />
        <Choice
          label={t("admin.filter.read")}
          value={filters.read}
          options={options("read", READS)}
          onChange={(read) => onFilterChange({ read })}
        />
        <SearchField
          value={filters.query}
          onChange={(query) => onFilterChange({ query })}
          label={t("admin.searchLabel")}
          placeholder={t("admin.search")}
          className="w-full sm:w-64"
        />
      </div>
    </div>
  );
}
