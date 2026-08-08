import { useCallback, useEffect, useState } from "react";
import * as admin from "../lib/admin.js";
import { useDebounced } from "./useDebounced.js";

export const CONFLICT_PAGE_SIZE = 25;

/** Shared: an expired token ends the session rather than showing an error. */
function useFailureHandler(onExpired, setError) {
  return useCallback(
    (cause) => {
      if (cause?.code === "unauthorized") onExpired();
      else setError(cause);
    },
    [onExpired, setError],
  );
}

/**
 * One page of the conflict list — the people the archive holds more than one
 * sticker for. Searching is the backend's work, debounced here.
 */
export function useConflicts({ token, query, page, onExpired }) {
  const [loaded, setLoaded] = useState(null); // { key, groups, total }
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  const settled = useDebounced(query);
  const key = JSON.stringify({ query: settled, page });
  const handle = useFailureHandler(onExpired, setError);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await admin.conflicts({
          token,
          query: settled,
          limit: CONFLICT_PAGE_SIZE,
          offset: page * CONFLICT_PAGE_SIZE,
        });
        if (cancelled) return;
        setError(null);
        setLoaded({ key, groups: result.items, total: result.total });
      } catch (cause) {
        if (!cancelled) handle(cause);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, key, nonce, page, settled, token]);

  const reload = useCallback(() => {
    setError(null);
    setNonce((value) => value + 1);
  }, []);

  return {
    groups: loaded?.groups ?? [],
    total: loaded?.total ?? 0,
    state: error ? "error" : loaded ? "ready" : "loading",
    stale: loaded !== null && loaded.key !== key,
    error,
    reload,
  };
}

/**
 * Every sticker held under one name, loaded when the drawer opens — the
 * photographs are fetched for the person a reviewer asked about, not for the
 * whole list. Mounted per person, so `name` never changes under it.
 *
 * `resolve` keeps the chosen sticker and destroys the rest of the group. It is
 * permanent, and it names its losers rather than letting the backend infer them.
 */
export function useConflictDetail({ token, name, onExpired, onResolved }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const handle = useFailureHandler(onExpired, setError);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await admin.conflictEntries({ token, name });
        if (!cancelled) {
          setError(null);
          setDetail(result);
        }
      } catch (cause) {
        if (!cancelled) handle(cause);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, name, token]);

  const resolve = useCallback(
    async (winnerId) => {
      if (!detail) return false;
      const loserIds = detail.entries.map((entry) => entry.id).filter((id) => id !== winnerId);
      if (loserIds.length === 0) return false;
      setBusy(true);
      try {
        await admin.resolveConflict({ token, winnerId, loserIds });
        onResolved?.();
        return true;
      } catch (cause) {
        handle(cause);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [detail, handle, onResolved, token],
  );

  return {
    detail,
    state: error ? "error" : detail ? "ready" : "loading",
    error,
    busy,
    resolve,
  };
}
