import { useCallback, useState } from "react";
import { useNameMatches } from "./useNameMatches.js";

const keyFor = (name) => name.trim().toLowerCase();

/**
 * The pause between the name and the rest of the wizard.
 *
 * Leaving the name step asks the archive who it already remembers under that
 * name. If it holds somebody, the flow stops on the decision screen — keep what
 * is here, begin again, or add this photograph alongside — and only goes on once
 * a person has said which. Nothing has been uploaded at this point, so choosing
 * the record that exists costs the visitor nothing.
 *
 * `settled` remembers the name that was decided about, not a flag: going back and
 * editing the name is a different question, and gets asked again.
 */
export function useNameGate(form) {
  const typed = form.step === "name" ? form.draft.personName : "";
  const search = useNameMatches(typed);

  const [screen, setScreen] = useState(null); // null | deciding | kept
  const [found, setFound] = useState({ matches: [], hasExact: false });
  const [settledName, setSettledName] = useState(null);
  const [asking, setAsking] = useState(false);

  const name = form.draft.personName.trim();
  const settled = settledName !== null && settledName === keyFor(name);

  /** The wizard's "next" on the name step: ask first, then advance or stop. */
  const advance = useCallback(async () => {
    if (form.step !== "name" || !form.canAdvance || settled) {
      form.next();
      return;
    }
    setAsking(true);
    const result = await search.ensure(form.draft.personName);
    setAsking(false);
    if (result.matches.length === 0) {
      form.next();
      return;
    }
    setFound(result);
    setScreen("deciding");
  }, [form, search, settled]);

  const close = useCallback(() => setScreen(null), []);

  return {
    ...found,
    name,
    screen,
    asking,
    notice: { checking: search.checking, matches: search.matches, hasExact: search.hasExact },
    advance,
    /** Keep the sticker that is already here and let this upload go. */
    keep: useCallback(() => setScreen("kept"), []),
    /** Back to an empty first step, for the sticker after this one. */
    restart: useCallback(() => {
      setScreen(null);
      setSettledName(null);
      form.reset();
    }, [form]),
    /**
     * On through the rest of the wizard with the draft untouched — whether this
     * is somebody else who happens to be named alike, or the same person whose
     * photograph deserves another. Either way nothing typed is thrown away and
     * the name is not asked about again.
     */
    proceed: useCallback(() => {
      setSettledName(keyFor(form.draft.personName));
      setScreen(null);
      form.next();
    }, [form]),
    /** Back to the name itself, for a spelling rather than a decision. */
    close,
  };
}
