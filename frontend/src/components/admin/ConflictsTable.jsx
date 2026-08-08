import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { formatShortDate } from "../../lib/format.js";

/**
 * People the archive holds more than one sticker for. A row is a person, not a
 * sticker; opening it is what loads their photographs.
 */
export function ConflictsTable({ groups, selectedName, onOpen, stale }) {
  const { t, locale } = useI18n();

  return (
    <Table
      aria-label={t("admin.conflicts.title")}
      removeWrapper
      selectionMode="none"
      onRowAction={(key) => onOpen(String(key))}
      classNames={{
        base: stale ? "opacity-60 transition-opacity duration-300" : "transition-opacity",
        th: "bg-transparent text-ink-muted text-[0.65rem] tracking-label uppercase font-normal border-b border-day-line/70 px-3 h-9",
        td: "px-3 py-3 align-top text-sm",
        tr: "border-b border-day-line/50 cursor-pointer transition-colors duration-700 ease-calm data-[hover=true]:bg-day-warm/50 outline-none focus-visible:bg-day-warm/60",
      }}
    >
      <TableHeader>
        <TableColumn>{t("admin.conflicts.col.name")}</TableColumn>
        <TableColumn>{t("admin.conflicts.col.count")}</TableColumn>
        <TableColumn className="hidden sm:table-cell">{t("admin.conflicts.col.votes")}</TableColumn>
        <TableColumn className="hidden md:table-cell">
          {t("admin.conflicts.col.similar")}
        </TableColumn>
        <TableColumn className="hidden sm:table-cell">
          {t("admin.conflicts.col.latest")}
        </TableColumn>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <TableRow
            key={group.normalized_name}
            className={group.normalized_name === selectedName ? "bg-day-warm/60" : undefined}
          >
            <TableCell>
              <span className="text-ink font-serif text-base break-words">{group.person_name}</span>
            </TableCell>
            <TableCell>
              <span className="border-sun/50 bg-sun-pale/70 text-sun-deep rounded-sm border px-2 py-0.5 text-[0.65rem] whitespace-nowrap">
                {t("admin.conflicts.stickers", { n: group.entry_count })}
              </span>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <span className="text-ink-muted text-xs tabular-nums">
                {t("admin.conflicts.votes", { n: group.vote_count })}
              </span>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {group.similar_names.length > 0 ? (
                <span className="text-ink-muted line-clamp-2 max-w-xs font-serif text-xs leading-relaxed">
                  {group.similar_names.join(" · ")}
                </span>
              ) : (
                <span className="text-ink-faint text-xs">{t("admin.conflicts.noSimilar")}</span>
              )}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <time dateTime={group.latest_at} className="text-ink-muted text-xs whitespace-nowrap">
                {formatShortDate(group.latest_at, locale)}
              </time>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
