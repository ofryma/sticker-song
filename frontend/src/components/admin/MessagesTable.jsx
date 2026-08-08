import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { formatShortDate } from "../../lib/format.js";

/* Warm tones only, never red. A message is somebody taking the trouble to write
   to us, including the ones asking for a sticker to come down. */
const KIND_TONE = {
  suggestion: "border-olive/45 bg-olive-pale/60 text-olive-deep",
  bug: "border-day-line bg-day-warm/70 text-ink-soft",
  entry_problem: "border-sun/50 bg-sun-pale/70 text-sun-deep",
};

/** What has come in, newest first. A row opens the message in the drawer. */
export function MessagesTable({ items, selectedId, onOpen, stale }) {
  const { t, locale } = useI18n();

  return (
    <Table
      aria-label={t("admin.messages.title")}
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
        <TableColumn>{t("admin.messages.col.kind")}</TableColumn>
        <TableColumn>{t("admin.messages.col.body")}</TableColumn>
        <TableColumn className="hidden md:table-cell">{t("admin.messages.col.entry")}</TableColumn>
        <TableColumn className="hidden sm:table-cell">{t("admin.messages.col.status")}</TableColumn>
        <TableColumn className="hidden sm:table-cell">{t("admin.messages.col.added")}</TableColumn>
      </TableHeader>
      <TableBody>
        {items.map((message) => (
          <TableRow
            key={message.id}
            className={message.id === selectedId ? "bg-day-warm/60" : undefined}
          >
            <TableCell>
              <span
                className={`rounded-sm border px-2 py-0.5 text-[0.65rem] whitespace-nowrap ${KIND_TONE[message.kind] ?? KIND_TONE.bug}`}
              >
                {t(`admin.messages.kind.${message.kind}`)}
              </span>
            </TableCell>
            <TableCell>
              <span className="text-ink-soft line-clamp-2 max-w-md leading-relaxed break-words">
                {message.body}
              </span>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {message.entry_person_name ? (
                <span className="text-ink font-serif text-sm break-words">
                  {message.entry_person_name}
                </span>
              ) : (
                <span className="text-ink-faint text-xs">—</span>
              )}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <span className="text-ink-muted text-xs whitespace-nowrap">
                {t(`admin.messages.status.${message.status}`)}
              </span>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <time
                dateTime={message.created_at}
                className="text-ink-muted text-xs whitespace-nowrap"
              >
                {formatShortDate(message.created_at, locale)}
              </time>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
