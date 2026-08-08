import { useCallback, useEffect, useState } from "react";
import * as admin from "../lib/admin.js";
import { useDebounced } from "./useDebounced.js";

export const MESSAGE_PAGE_SIZE = 25;

/**
 * One page of the messages list, plus the counts behind the status tabs.
 *
 * The counts are the whole notification story: nothing is emailed and nothing is
 * pushed, so the open count on the tab is how somebody finds out that a takedown
 * request is waiting.
 */
export function useMessages({ token, status, kind, query, page, onExpired }) {
  const [loaded, setLoaded] = useState(null); // { key, items, total }
  const [tally, setTally] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  const settled = useDebounced(query);
  const key = JSON.stringify({ status, kind, query: settled, page });

  const handle = useCallback(
    (cause) => {
      if (cause?.code === "unauthorized") onExpired();
      else setError(cause);
    },
    [onExpired],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [page_, counts] = await Promise.all([
          admin.messages({
            token,
            status,
            kind,
            query: settled,
            limit: MESSAGE_PAGE_SIZE,
            offset: page * MESSAGE_PAGE_SIZE,
          }),
          admin.messageCounts(token),
        ]);
        if (cancelled) return;
        setError(null);
        setTally(counts);
        setLoaded({ key, items: page_.items, total: page_.total });
      } catch (cause) {
        if (!cancelled) handle(cause);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, key, kind, nonce, page, settled, status, token]);

  const reload = useCallback(() => {
    setError(null);
    setNonce((value) => value + 1);
  }, []);

  /** Mark one message dealt with, or as needing nothing. Returns whether it took. */
  const decide = useCallback(
    async (id, action) => {
      setBusy(true);
      try {
        await admin.decideMessage({ token, id, action });
        reload();
        return true;
      } catch (cause) {
        handle(cause);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [handle, reload, token],
  );

  return {
    items: loaded?.items ?? [],
    total: loaded?.total ?? 0,
    tally,
    state: error ? "error" : loaded ? "ready" : "loading",
    stale: loaded !== null && loaded.key !== key,
    error,
    busy,
    decide,
    reload,
  };
}
