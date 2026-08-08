import { useCallback, useEffect, useState } from "react";
import { listEntries } from "../lib/api.js";

const PAGE = 50;

/**
 * Loads entries newest-first with append-style paging.
 * `status` is one of "loading" | "ready" | "error".
 */
export function useEntries({ limit = PAGE } = {}) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [exhausted, setExhausted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (offset) => {
      const page = await listEntries({ limit, offset });
      setExhausted(page.length < limit);
      return page;
    },
    [limit],
  );

  const reload = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      setEntries(await fetchPage(0));
      setStatus("ready");
    } catch (cause) {
      setError(cause);
      setStatus("error");
    }
  }, [fetchPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await fetchPage(0);
        if (!cancelled) {
          setEntries(page);
          setStatus("ready");
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause);
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || exhausted) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(entries.length);
      setEntries((current) => [...current, ...page]);
    } catch (cause) {
      setError(cause);
    } finally {
      setLoadingMore(false);
    }
  }, [entries.length, exhausted, fetchPage, loadingMore]);

  return { entries, status, error, reload, loadMore, loadingMore, exhausted };
}
