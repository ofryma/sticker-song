import { useMemo, useState } from "react";
import { useI18n } from "../i18n/index.jsx";
import { useEntries } from "../hooks/useEntries.js";
import { matchesQuery, pluralCount } from "../lib/format.js";
import { Page } from "../components/Section.jsx";
import { Collage } from "../components/collage/Collage.jsx";
import { WallGrid } from "../components/WallGrid.jsx";
import { EntryDetail } from "../components/EntryDetail.jsx";
import { EmptyWall, ErrorState, Loading, NoResults } from "../components/States.jsx";
import { WallSearchBar } from "../components/WallSearchBar.jsx";
import { Action } from "../components/ui/Action.jsx";

export default function Wall() {
  const { t } = useI18n();
  const { entries, status, error, reload, loadMore, loadingMore, exhausted } = useEntries();
  const [query, setQuery] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const searching = query.trim().length > 0;
  // Search and full browsing both replace the collage with a readable grid.
  const listed = searching || browsing;

  const visible = useMemo(
    () => entries.filter((entry) => matchesQuery(entry, query)),
    [entries, query],
  );

  // Index into the filtered list, so arrow keys walk what is on screen.
  const index = visible.findIndex((entry) => entry.id === selectedId);
  const step = (delta) => {
    const next = visible[index + delta];
    if (next) setSelectedId(next.id);
  };

  const ready = status === "ready" && entries.length > 0;

  return (
    // The images open the page; the words and the search sit beneath them.
    <Page className="pt-6 sm:pt-20">
      {status === "loading" && <Loading label={t("wall.loading")} />}
      {status === "error" && <ErrorState error={error} onRetry={reload} />}

      {status === "ready" && entries.length === 0 && <EmptyWall />}

      {ready && !listed && (
        <Collage entries={entries} onOpen={(entry) => setSelectedId(entry.id)} />
      )}

      {ready &&
        listed &&
        (visible.length === 0 ? (
          <NoResults onClear={() => setQuery("")} />
        ) : (
          <>
            <WallGrid entries={visible} onOpen={(entry) => setSelectedId(entry.id)} />
            {!exhausted && !searching && (
              <div className="mt-16 flex justify-center">
                <Action tone="ghost" onPress={loadMore} isLoading={loadingMore}>
                  {t("wall.loadMore")}
                </Action>
              </div>
            )}
          </>
        ))}

      {ready && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs tracking-label text-ink-muted uppercase">
            {pluralCount(t, "wall.results", listed ? visible.length : entries.length)}
          </p>
          {listed ? (
            !searching && (
              <Action tone="quiet" size="sm" onPress={() => setBrowsing(false)}>
                {t("wall.backToCollage")}
              </Action>
            )
          ) : (
            <Action tone="quiet" size="sm" onPress={() => setBrowsing(true)}>
              {t("wall.browseAll")}
            </Action>
          )}
        </div>
      )}

      <header className="mt-12 max-w-xl sm:mt-16">
        <p className="eyebrow mb-3">{t("wall.kicker")}</p>
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          {t("wall.title")}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          {listed ? t("wall.lead") : t("wall.collageHint")}
        </p>
      </header>

      {ready && <WallSearchBar value={query} onChange={setQuery} />}

      <EntryDetail
        entry={index >= 0 ? visible[index] : null}
        onClose={() => setSelectedId(null)}
        onPrev={index > 0 ? () => step(-1) : undefined}
        onNext={index >= 0 && index < visible.length - 1 ? () => step(1) : undefined}
      />
    </Page>
  );
}
