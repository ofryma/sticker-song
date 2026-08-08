import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { formatShortDate } from "../../lib/format.js";

/* The status a row carries, in palette terms. Never red: holding a submission
   back is a decision about a photograph, not a verdict on a person. */
const STATUS_TONE = {
  pending: "border-sun/50 bg-sun-pale/70 text-sun-deep",
  published: "border-olive/40 bg-olive-pale/70 text-olive-deep",
  rejected: "border-day-line bg-day-warm/70 text-ink-muted",
};

const READ_TONE = {
  flag: "bg-sun",
  ok: "bg-olive",
  error: "bg-day-line",
};

function Pill({ children, className }) {
  return (
    <span className={`rounded-sm border px-2 py-0.5 text-[0.65rem] whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

/**
 * The queue as a list rather than a wall of photographs: a reviewer scanning
 * thirty submissions needs names and words, and the photograph one at a time.
 * Opening a row is what fetches its image — see `ReviewDrawer`.
 */
export function EntriesTable({ entries, selectedId, onOpen, sort, onSortChange, stale }) {
  const { t, locale } = useI18n();

  return (
    <Table
      aria-label={t("admin.queue")}
      removeWrapper
      selectionMode="none"
      onRowAction={(key) => onOpen(String(key))}
      // The database does the ordering; this only says which column and which way.
      sortDescriptor={{
        column: sort.column,
        direction: sort.direction === "asc" ? "ascending" : "descending",
      }}
      onSortChange={(descriptor) =>
        onSortChange({
          column: String(descriptor.column),
          direction: descriptor.direction === "ascending" ? "asc" : "desc",
        })
      }
      classNames={{
        // While the next page loads the current one stays, dimmed, rather than
        // the table blanking under the reviewer.
        base: stale ? "opacity-60 transition-opacity duration-300" : "transition-opacity",
        th: "bg-transparent text-ink-muted text-[0.65rem] tracking-label uppercase font-normal border-b border-day-line/70 px-3 h-9",
        td: "px-3 py-3 align-top text-sm",
        tr: "border-b border-day-line/50 cursor-pointer transition-colors duration-700 ease-calm data-[hover=true]:bg-day-warm/50 outline-none focus-visible:bg-day-warm/60",
      }}
    >
      <TableHeader>
        <TableColumn key="name" allowsSorting>
          {t("admin.col.name")}
        </TableColumn>
        <TableColumn key="text" className="hidden sm:table-cell">
          {t("admin.col.text")}
        </TableColumn>
        <TableColumn key="read" allowsSorting className="hidden md:table-cell">
          {t("admin.col.read")}
        </TableColumn>
        <TableColumn key="status" allowsSorting>
          {t("admin.col.status")}
        </TableColumn>
        <TableColumn key="added" allowsSorting className="hidden sm:table-cell">
          {t("admin.col.added")}
        </TableColumn>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow
            key={entry.id}
            className={entry.id === selectedId ? "bg-day-warm/60" : undefined}
          >
            <TableCell>
              <span className="text-ink font-serif text-base break-words">{entry.person_name}</span>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <span className="text-ink-muted line-clamp-2 max-w-md font-serif text-sm leading-relaxed">
                {entry.sticker_text}
              </span>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {entry.llm_verdict ? (
                <span className="text-ink-muted flex items-center gap-2 text-xs">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${READ_TONE[entry.llm_verdict] ?? READ_TONE.error}`}
                    aria-hidden="true"
                  />
                  {t(`admin.llm.${entry.llm_verdict}`)}
                </span>
              ) : (
                <span className="text-ink-faint text-xs">{t("admin.llm.unread")}</span>
              )}
            </TableCell>
            <TableCell>
              <Pill className={STATUS_TONE[entry.status] ?? STATUS_TONE.rejected}>
                {t(`admin.status.${entry.status}`)}
              </Pill>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <time
                dateTime={entry.created_at}
                className="text-ink-muted text-xs whitespace-nowrap"
              >
                {formatShortDate(entry.created_at, locale)}
              </time>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
