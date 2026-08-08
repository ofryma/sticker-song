import { useCallback, useState } from "react";
import { sendMessage } from "../lib/api.js";

/* The backend refuses a shorter body, so the page has to know the number too —
   and say so before anybody runs into it. Keep the two in step: see
   `MESSAGE_MIN_BODY` in backend/app/schemas.py. */
export const MIN_BODY = 20;

/* `website` is the honeypot: a field no person ever sees, so anything in it came
   from a script. It stays empty here and travels as-is. */
const EMPTY = { kind: "", body: "", replyEmail: "", website: "" };

/* Deliberately loose. An address is optional here and a slightly wrong one costs
   one reply, so this only catches what cannot be an address at all — the same
   line the backend draws. */
function looksLikeEmail(address) {
  const [local, domain, ...rest] = address.split("@");
  return Boolean(local) && Boolean(domain) && rest.length === 0 && /[^.]\.[^.]/.test(domain);
}

/** Which requirement, if any, stands between the draft and sending it. */
function blockerFor(draft) {
  if (!draft.kind) return "kind";
  if (draft.body.trim().length < MIN_BODY) return "body";
  if (draft.replyEmail.trim() && !looksLikeEmail(draft.replyEmail.trim())) return "email";
  return null;
}

/**
 * The contact form: what is written, what stops it being sent, and the send.
 *
 * `entryId` comes from the query string when a visitor arrived from a sticker,
 * and travels with the message so an admin sees which one they meant.
 */
export function useContactMessage({ kind = "", entryId = null } = {}) {
  const [draft, setDraft] = useState({ ...EMPTY, kind });
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState("editing"); // editing | sending | done | error
  const [error, setError] = useState(null);

  const blocker = blockerFor(draft);

  const set = useCallback((patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setTouched(false);
  }, []);

  const submit = useCallback(async () => {
    if (blockerFor(draft)) {
      setTouched(true);
      return;
    }
    setState("sending");
    setError(null);
    try {
      await sendMessage({
        kind: draft.kind,
        body: draft.body.trim(),
        entryId,
        replyEmail: draft.replyEmail.trim(),
        website: draft.website,
      });
      setState("done");
    } catch (cause) {
      setError(cause);
      setState("error");
    }
  }, [draft, entryId]);

  return {
    draft,
    set,
    submit,
    state,
    error,
    blocker: touched ? blocker : null,
  };
}
