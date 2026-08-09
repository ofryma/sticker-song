import { useCallback, useEffect, useMemo, useState } from "react";
import * as admin from "../lib/admin.js";
import { useDebounced } from "./useDebounced.js";

/**
 * One page of the review queue, plus the per-status tallies.
 *
 * The backend does the filtering, the sorting and the paging; this hook decides
 * when to ask. The search is debounced so typing sends one request rather than
 * one per keystroke.
 *
 * A decision removes the entry from the page straight away rather than waiting on
 * a refetch — the reviewer is working through a queue and the next draft should
 * be in front of them immediately — and the true page follows behind it.
 *
 * While a new page loads the previous one stays on screen, marked `stale`, so
 * changing a filter does not blank the table.
 */
export function useReviewQueue({ token, status, filters, sort, page, onExpired }) {
  const [loaded, setLoaded] = useState(null); // { key, entries, total, tally }
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [nonce, setNonce] = useState(0);

  const query = useDebounced(filters.query);
  // The request is derived from its own serialization: callers rebuild the
  // filter and sort objects on every render, and an effect keyed on their
  // identity would refetch on every render with them.
  const key = JSON.stringify({
    status,
    filters: { query, period: filters.period, read: filters.read },
    sort,
    page,
  });
  const request = useMemo(() => JSON.parse(key), [key]);

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
        const [result, tally] = await Promise.all([
          admin.listEntries({ token, ...request }),
          admin.counts(token),
        ]);
        if (cancelled) return;
        setError(null);
        setLoaded({ key, entries: result.items, total: result.total, tally });
      } catch (cause) {
        if (!cancelled) handle(cause);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `key` is the serialized `request`; both change together.
  }, [handle, key, nonce, request, token]);

  const reload = useCallback(() => {
    setError(null);
    setNonce((value) => value + 1);
  }, []);

  /** Resolves true when the decision went through, so the caller can move on. */
  const act = useCallback(
    async (action, id, note) => {
      setBusyId(id);
      try {
        let decided = null;
        if (action === "publish") decided = await admin.publish({ token, id, note });
        else if (action === "reject") decided = await admin.reject({ token, id, note });
        else if (action === "delete") await admin.remove({ token, id });
        const tally = await admin.counts(token);
        setLoaded((current) => {
          if (current === null) return current;
          // On a single status the entry has left that slice; on "all" it is
          // still in view and only its status has changed.
          const keeps = status === "all" && decided !== null;
          return {
            ...current,
            entries: keeps
              ? current.entries.map((entry) => (entry.id === id ? decided : entry))
              : current.entries.filter((entry) => entry.id !== id),
            total: keeps ? current.total : current.total - 1,
            tally,
          };
        });
        // The page has a hole in it now: pull the true one back.
        reload();
        return true;
      } catch (cause) {
        handle(cause);
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [handle, reload, status, token],
  );

  /**
   * A correction: the changed fields, a replacement photograph, or both. The
   * photograph goes first, so a failure there leaves the entry untouched rather
   * than renamed around a picture that never arrived.
   *
   * The row is replaced where it sits rather than the page being pulled again:
   * a reviewer who has just fixed a name is still reading that entry, and a
   * refetch could reorder or filter it out from under them.
   */
  const save = useCallback(
    async (id, { patch, file } = {}) => {
      setBusyId(id);
      try {
        let saved = null;
        if (file) saved = await admin.replaceImage({ token, id, file });
        if (patch && Object.keys(patch).length > 0) {
          saved = await admin.updateEntry({ token, id, patch });
        }
        if (saved !== null) {
          setLoaded((current) =>
            current === null
              ? current
              : {
                  ...current,
                  entries: current.entries.map((entry) => (entry.id === id ? saved : entry)),
                },
          );
        }
        return { ok: true };
      } catch (cause) {
        // A refused correction is about the fields in front of the reviewer, so
        // it is answered beside them rather than by replacing the whole queue
        // with an error — which is what `handle` does for a failed fetch.
        if (cause?.code === "unauthorized") onExpired();
        return { ok: false, error: cause };
      } finally {
        setBusyId(null);
      }
    },
    [onExpired, token],
  );

  /** Re-run the LLM read; the note updates in place. */
  const reanalyze = useCallback(
    async (id) => {
      setBusyId(id);
      try {
        const updated = await admin.analyze({ token, id });
        setLoaded((current) =>
          current === null
            ? current
            : {
                ...current,
                entries: current.entries.map((entry) => (entry.id === id ? updated : entry)),
              },
        );
      } catch (cause) {
        handle(cause);
      } finally {
        setBusyId(null);
      }
    },
    [handle, token],
  );

  return {
    entries: loaded?.entries ?? [],
    total: loaded?.total ?? 0,
    tally: loaded?.tally ?? null,
    state: error ? "error" : loaded ? "ready" : "loading",
    stale: loaded !== null && loaded.key !== key,
    error,
    busyId,
    reload,
    act,
    save,
    reanalyze,
  };
}
