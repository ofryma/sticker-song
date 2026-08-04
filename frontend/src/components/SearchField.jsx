import { Input } from "@heroui/react";
import { useI18n } from "../i18n/index.jsx";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-ink-muted" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SearchField({ value, onChange }) {
  const { t } = useI18n();

  return (
    <Input
      type="search"
      value={value}
      onValueChange={onChange}
      isClearable
      onClear={() => onChange("")}
      aria-label={t("wall.searchLabel")}
      placeholder={t("wall.search")}
      startContent={<SearchIcon />}
      radius="sm"
      variant="bordered"
      classNames={{
        base: "w-full sm:w-80",
        // text-base keeps iOS Safari from zooming the page on focus.
        input: "text-base sm:text-sm placeholder:text-ink-muted",
        inputWrapper:
          "border-day-line bg-day-soft/70 transition-colors duration-700 ease-calm " +
          "hover:border-tekhelet-light/50 group-data-[focus=true]:border-tekhelet-light",
      }}
    />
  );
}
