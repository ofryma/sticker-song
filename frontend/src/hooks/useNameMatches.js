import { useCallback, useEffect, useRef, useState } from "react";
import { findNameMatches } from "../lib/api.js";

/** Below this a name is too little to search on — initials match half the wall. */
const MIN_LENGTH = 2;
/** Long enough that the lookup follows a typed name rather than each letter. */
const DEBOUNCE_MS = 500;

const EMPTY = { matches: [], hasExact: false };

const keyFor = (name) => name.trim().toLowerCase();

/**
 * What the archive already holds under the name being typed.
 *
 * Two ways in, over one cache. The debounced effect keeps `result` in step with
 * the field, so the step can say quietly that this name is already here; and
 * `ensure()` answers for a given name straight away — the wizard calls it as the
 * name step is left, so the decision is never made on a stale answer or missed
 * because somebody typed and pressed on in the same breath.
 *
 * A failed lookup answers "nothing found": this is a courtesy before an upload,
 * and it must never be the reason a submission cannot go on.
 */
export function useNameMatches(name) {
  // Keyed by the name it answers, so "still looking" is derived from the field
  // rather than kept in step with it by hand.
  const [answer, setAnswer] = useState({ key: null, result: EMPTY });
  const cache = useRef(new Map());

  const ensure = useCallback(async (value) => {
    const key = keyFor(value);
    if (key.length < MIN_LENGTH) return EMPTY;
    const cached = cache.current.get(key);
    // A promise while the request is in flight, the answer once it has landed —
    // awaiting either is the same thing here.
    if (cached) return cached;

    const pending = findNameMatches(value)
      .then((body) => {
        const found = { matches: body.matches ?? [], hasExact: Boolean(body.has_exact_match) };
        cache.current.set(key, found);
        return found;
      })
      .catch(() => {
        cache.current.delete(key);
        return EMPTY;
      });

    cache.current.set(key, pending);
    return pending;
  }, []);

  const key = keyFor(name ?? "");
  const searchable = key.length >= MIN_LENGTH;

  useEffect(() => {
    if (!searchable) return;

    let live = true;
    const timer = setTimeout(() => {
      ensure(key).then((result) => {
        if (live) setAnswer({ key, result });
      });
    }, DEBOUNCE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key, searchable, ensure]);

  const answered = searchable && answer.key === key;

  return {
    ...(answered ? answer.result : EMPTY),
    checking: searchable && !answered,
    ensure,
  };
}
