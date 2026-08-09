import { useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { useReviewQueue } from "../../hooks/useReviewQueue.js";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  PAGE_SIZE,
  isFiltered,
  resolveSort,
} from "../../lib/review.js";
import { ErrorState, Loading } from "../States.jsx";
import { FilterBar } from "./FilterBar.jsx";
import { EntriesTable } from "./EntriesTable.jsx";
import { Pager } from "./Pager.jsx";
import { ReviewDrawer } from "./ReviewDrawer.jsx";

/** The submissions tab: the review queue, filtered, sorted and paged. */
export function QueueView({ token, status, onStatusChange, onExpired }) {
  const { t } = useI18n();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [chosenSort, setChosenSort] = useState(DEFAULT_SORT);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);
  const sort = resolveSort(chosenSort, status);
  const queue = useReviewQueue({ token, status, filters, sort, page, onExpired });

  // Narrowing or reordering makes the current page number meaningless.
  const changeStatus = (next) => (onStatusChange(next), setPage(0));
  const changeFilters = (patch) => (setFilters((c) => ({ ...c, ...patch })), setPage(0));
  const changeSort = (next) => (setChosenSort(next), setPage(0));

  const entries = queue.entries;
  // A decided or deleted entry leaves the page, and the drawer closes with it.
  const open = entries.find((entry) => entry.id === openId) ?? null;

  // Reviewing is a run through a queue: once a submission is decided the next one
  // takes its place in the drawer, so the reviewer never returns to the list to
  // start again. The last one in the queue closes it. On "all" the entry stays in
  // view — only its status changed — so nothing moves.
  const decide = async (action, id, note) => {
    const index = entries.findIndex((entry) => entry.id === id);
    const next = index === -1 ? null : (entries[index + 1] ?? null);
    const done = await queue.act(action, id, note);
    if (done && status !== "all") setOpenId(next?.id ?? null);
  };

  return (
    <>
      <FilterBar
        status={status}
        onStatusChange={changeStatus}
        filters={filters}
        onFilterChange={changeFilters}
        tally={queue.tally}
      />

      <div className="mt-6">
        {queue.state === "loading" && <Loading label={t("admin.loading")} />}
        {queue.state === "error" && <ErrorState error={queue.error} onRetry={queue.reload} />}
        {queue.state === "ready" &&
          (entries.length === 0 ? (
            <p className="animate-fade text-ink-muted py-20 text-center text-sm">
              {isFiltered(filters) ? t("admin.noResults") : t(`admin.empty.${status}`)}
            </p>
          ) : (
            <>
              <EntriesTable
                entries={entries}
                selectedId={openId}
                onOpen={setOpenId}
                sort={sort}
                onSortChange={changeSort}
                stale={queue.stale}
              />
              <Pager page={page} pageSize={PAGE_SIZE} total={queue.total} onChange={setPage} />
            </>
          ))}
      </div>

      <ReviewDrawer
        entry={open}
        token={token}
        busy={open ? queue.busyId === open.id : false}
        onClose={() => setOpenId(null)}
        onAct={decide}
        onSave={queue.save}
        onReanalyze={queue.reanalyze}
      />
    </>
  );
}
