import { useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { CONFLICT_PAGE_SIZE, useConflicts } from "../../hooks/useConflicts.js";
import { ErrorState, Loading } from "../States.jsx";
import { SearchField } from "../SearchField.jsx";
import { ConflictsTable } from "./ConflictsTable.jsx";
import { ConflictDrawer } from "./ConflictDrawer.jsx";
import { Pager } from "./Pager.jsx";

/**
 * The conflicts tab: every person the archive holds more than one sticker for.
 * Opening one is what loads their photographs, and resolving keeps the sticker
 * the reviewer chose.
 */
export function ConflictsView({ token, onExpired }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [openName, setOpenName] = useState(null);
  const conflicts = useConflicts({ token, query, page, onExpired });

  const search = (next) => (setQuery(next), setPage(0));

  return (
    <>
      <div className="border-day-line/70 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <p className="text-ink-muted max-w-xl text-sm leading-relaxed">
          {t("admin.conflicts.lead")}
        </p>
        <SearchField
          value={query}
          onChange={search}
          label={t("admin.conflicts.searchLabel")}
          placeholder={t("admin.conflicts.search")}
          className="w-full sm:w-64"
        />
      </div>

      <div className="mt-6">
        {conflicts.state === "loading" && <Loading label={t("admin.conflicts.loading")} />}
        {conflicts.state === "error" && (
          <ErrorState error={conflicts.error} onRetry={conflicts.reload} />
        )}
        {conflicts.state === "ready" &&
          (conflicts.groups.length === 0 ? (
            <p className="animate-fade text-ink-muted py-20 text-center text-sm">
              {query.trim() ? t("admin.conflicts.noResults") : t("admin.conflicts.empty")}
            </p>
          ) : (
            <>
              <ConflictsTable
                groups={conflicts.groups}
                selectedName={openName}
                onOpen={setOpenName}
                stale={conflicts.stale}
              />
              <Pager
                page={page}
                pageSize={CONFLICT_PAGE_SIZE}
                total={conflicts.total}
                onChange={setPage}
              />
            </>
          ))}
      </div>

      <ConflictDrawer
        name={openName}
        token={token}
        onClose={() => setOpenName(null)}
        onExpired={onExpired}
        onResolved={conflicts.reload}
      />
    </>
  );
}
