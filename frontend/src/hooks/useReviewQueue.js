import { useCallback, useEffect, useState } from "react";
import * as admin from "../lib/admin.js";

/**
 * The review queue for one status, plus the per-status tallies.
 *
 * A decision removes the entry from the list straight away rather than waiting on
 * a refetch — the reviewer is working through a queue and the next draft should be
 * in front of them immediately.
 *
 * Nothing is set synchronously inside the effect: the fetch tells us which status
 * its rows belong to, and `state` is derived from that, so switching tabs never
 * shows the previous tab's entries under the new heading.
 */
export function useReviewQueue({ token, status, onExpired }) {
  const [loaded, setLoaded] = useState(null); // { status, entries, tally }
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [nonce, setNonce] = useState(0);

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
        const [entries, tally] = await Promise.all([
          admin.listEntries({ token, status }),
          admin.counts(token),
        ]);
        if (cancelled) return;
        setError(null);
        setLoaded({ status, entries, tally });
      } catch (cause) {
        if (!cancelled) handle(cause);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, nonce, status, token]);

  const reload = useCallback(() => {
    setError(null);
    setNonce((value) => value + 1);
  }, []);

  const fresh = loaded?.status === status ? loaded : null;

  const act = useCallback(
    async (action, id, note) => {
      setBusyId(id);
      try {
        if (action === "publish") await admin.publish({ token, id, note });
        else if (action === "reject") await admin.reject({ token, id, note });
        else if (action === "delete") await admin.remove({ token, id });
        const tally = await admin.counts(token);
        setLoaded((current) =>
          current === null
            ? current
            : {
                ...current,
                entries: current.entries.filter((entry) => entry.id !== id),
                tally,
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
    entries: fresh?.entries ?? [],
    tally: fresh?.tally ?? null,
    state: error ? "error" : fresh ? "ready" : "loading",
    error,
    busyId,
    reload,
    act,
    reanalyze,
  };
}
