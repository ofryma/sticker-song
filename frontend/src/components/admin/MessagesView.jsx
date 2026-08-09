import { useState } from "react";
import { Select, SelectItem, Tab, Tabs } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { MESSAGE_PAGE_SIZE, useMessages } from "../../hooks/useMessages.js";
import { ErrorState, Loading } from "../States.jsx";
import { SearchField } from "../SearchField.jsx";
import { MessagesTable } from "./MessagesTable.jsx";
import { MessageDrawer } from "./MessageDrawer.jsx";
import { Pager } from "./Pager.jsx";

const STATUSES = ["open", "resolved", "dismissed", "all"];
const KINDS = ["all", "suggestion", "bug", "entry_problem"];

/**
 * The messages tab: suggestions, faults, and problems with a sticker. Deciding
 * one closes it — nothing here deletes a message, because "somebody looked and
 * there was nothing to do" is worth telling apart from nobody having looked.
 */
export function MessagesView({ token, onExpired }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);

  const messages = useMessages({ token, status, kind, query, page, onExpired });
  // Read from the current page rather than held separately, so a message that
  // leaves the view when it is decided takes the drawer with it.
  const open = messages.items.find((message) => message.id === openId) ?? null;

  // Every change of what is being looked at starts again at the first page.
  const change = (setter) => (value) => (setter(value), setPage(0));

  // Deciding a message carries the drawer on to the one below it, so a run of
  // waiting messages can be worked through without going back to the list. The
  // last one on the page has nowhere to go, and closes.
  const decide = async (id, action) => {
    const at = messages.items.findIndex((message) => message.id === id);
    if (!(await messages.decide(id, action))) return;
    setOpenId(messages.items[at + 1]?.id ?? null);
  };

  const countOf = (key) =>
    !messages.tally
      ? null
      : key === "all"
        ? messages.tally.open + messages.tally.resolved + messages.tally.dismissed
        : messages.tally[key];

  return (
    <>
      <div className="border-day-line/70 flex flex-col gap-4 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          aria-label={t("admin.messages.title")}
          selectedKey={status}
          onSelectionChange={(key) => change(setStatus)(String(key))}
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
                  {t(`admin.messages.status.${key}`)}
                  {countOf(key) != null && (
                    <span className="text-ink-faint text-xs tabular-nums">{countOf(key)}</span>
                  )}
                </span>
              }
            />
          ))}
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            aria-label={t("admin.messages.filterKind")}
            selectedKeys={[kind]}
            onSelectionChange={(keys) => change(setKind)([...keys][0] ?? "all")}
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
            {KINDS.map((key) => (
              <SelectItem key={key}>{t(`admin.messages.kind.${key}`)}</SelectItem>
            ))}
          </Select>
          <SearchField
            value={query}
            onChange={change(setQuery)}
            label={t("admin.messages.searchLabel")}
            placeholder={t("admin.messages.search")}
            className="w-full sm:w-64"
          />
        </div>
      </div>

      <div className="mt-6">
        {messages.state === "loading" && <Loading label={t("admin.messages.loading")} />}
        {messages.state === "error" && (
          <ErrorState error={messages.error} onRetry={messages.reload} />
        )}
        {messages.state === "ready" &&
          (messages.items.length === 0 ? (
            <p className="animate-fade text-ink-muted py-20 text-center text-sm">
              {query.trim() || kind !== "all" || status !== "open"
                ? t("admin.messages.noResults")
                : t("admin.messages.empty")}
            </p>
          ) : (
            <>
              <MessagesTable
                items={messages.items}
                selectedId={openId}
                onOpen={setOpenId}
                stale={messages.stale}
              />
              <Pager
                page={page}
                pageSize={MESSAGE_PAGE_SIZE}
                total={messages.total}
                onChange={setPage}
              />
            </>
          ))}
      </div>

      <MessageDrawer
        message={open}
        busy={messages.busy}
        onClose={() => setOpenId(null)}
        onDecide={decide}
      />
    </>
  );
}
