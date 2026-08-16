import { useCallback, useMemo, useState } from "react";
import { useI18n } from "../i18n/index.jsx";
import { useEntries } from "../hooks/useEntries.js";
import { matchesQuery, pluralCount } from "../lib/format.js";
import { Page } from "../components/Section.jsx";
import { Collage } from "../components/collage/Collage.jsx";
import { WallGrid } from "../components/WallGrid.jsx";
import { WallStage } from "../components/WallStage.jsx";
import { EntryDetail } from "../components/EntryDetail.jsx";
import { EmptyWall, ErrorState, Loading, NoResults } from "../components/States.jsx";
import { WallSearchBar } from "../components/WallSearchBar.jsx";
import { Action } from "../components/ui/Action.jsx";
import { requestFullscreen } from "../hooks/useFullscreen.js";

export default function Wall() {
  const { t } = useI18n();
  const { entries, status, error, reload, loadMore, loadingMore, exhausted } = useEntries();
  const [query, setQuery] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  // The collage, alone on the screen. Asking for the screen has to happen inside
  // the press itself, or the browser treats it as unprompted and refuses.
  const [staged, setStaged] = useState(false);
  const openStage = () => {
    requestFullscreen();
    setStaged(true);
  };
  const closeStage = useCallback(() => setStaged(false), []);

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
  // The collage pulls the next page itself as it reaches the end of the loaded
  // entries; once the archive is exhausted there is nothing left to ask for.
  const needMore = exhausted ? undefined : loadMore;

  // The collage opens the page at the very top of the screen, under the
  // transparent header; a list of names is read, so it keeps its room.
  const flush = ready && !listed;

  return (
    // The images open the page; the words and the search sit beneath them. The
    // collage is outside the page shell, so it runs edge to edge of the screen.
    <>
      {ready && !listed && (
        <Collage
          entries={entries}
          onOpen={(entry) => setSelectedId(entry.id)}
          onNeedMore={needMore}
        />
      )}

      <Page flush={flush}>
        {status === "loading" && <Loading label={t("wall.loading")} />}
        {status === "error" && <ErrorState error={error} onRetry={reload} />}

        {status === "ready" && entries.length === 0 && <EmptyWall />}

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
              <div className="flex shrink-0 items-center gap-1">
                <Action tone="quiet" size="sm" onPress={openStage}>
                  {t("wall.fullscreen")}
                </Action>
                <Action tone="quiet" size="sm" onPress={() => setBrowsing(true)}>
                  {t("wall.browseAll")}
                </Action>
              </div>
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

        {ready && staged && !listed && (
          <WallStage
            entries={entries}
            onOpen={(entry) => setSelectedId(entry.id)}
            onClose={closeStage}
            onNeedMore={needMore}
          />
        )}

        <EntryDetail
          entry={index >= 0 ? visible[index] : null}
          onClose={() => setSelectedId(null)}
          onPrev={index > 0 ? () => step(-1) : undefined}
          onNext={index >= 0 && index < visible.length - 1 ? () => step(1) : undefined}
        />
      </Page>
    </>
  );
}
