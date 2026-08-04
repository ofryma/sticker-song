import { useCallback, useEffect, useRef, useState } from "react";
import { createEntry } from "../lib/api.js";

export const STEPS = ["photo", "name", "text", "place"];
const MAX_BYTES = 10 * 1024 * 1024;

const EMPTY = { image: null, personName: "", stickerText: "", latitude: null, longitude: null };

/** Which requirement, if any, blocks leaving a given step. */
function blockerFor(step, draft) {
  if (step === "photo" && !draft.image) return "image";
  if (step === "name" && !draft.personName.trim()) return "name";
  if (step === "text" && !draft.stickerText.trim()) return "text";
  return null;
}

/** The whole submission flow: draft state, step movement, upload, result. */
export function useStickerDraft() {
  const [draft, setDraft] = useState(EMPTY);
  const [stepIndex, setStepIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState("editing"); // editing | saving | done | error
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  // What the backend suspects is the same person, returned with the new entry.
  const [duplicates, setDuplicates] = useState([]);
  const [suggestedBestId, setSuggestedBestId] = useState(null);
  // True when the entry is kept as a draft, waiting for a reviewer.
  const [awaitingReview, setAwaitingReview] = useState(false);
  // The object URL is state because the render reads it; the ref is only so the
  // unmount cleanup can revoke whatever URL is live at that moment.
  const [preview, setPreview] = useState(null);
  const previewUrl = useRef(null);

  const step = STEPS[stepIndex];
  const blocker = blockerFor(step, draft);

  const set = useCallback((patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setTouched(false);
  }, []);

  // Object URLs are revoked as soon as the photo is swapped or dropped.
  const setImage = useCallback((file) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : null;
    setPreview(previewUrl.current);
    setDraft((current) => ({ ...current, image: file }));
    setTouched(false);
  }, []);

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  const next = useCallback(() => {
    if (blocker) {
      setTouched(true);
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, [blocker]);

  const back = useCallback(() => setStepIndex((i) => Math.max(i - 1, 0)), []);

  const submit = useCallback(async () => {
    setState("saving");
    setError(null);
    try {
      const result = await createEntry(draft);
      setSaved(result.entry);
      setDuplicates(result.possible_duplicates ?? []);
      setSuggestedBestId(result.suggested_best_id ?? null);
      setAwaitingReview(Boolean(result.awaiting_review));
      setState("done");
    } catch (cause) {
      setError(cause);
      setState("error");
    }
  }, [draft]);

  const reset = useCallback(() => {
    setImage(null);
    setDraft(EMPTY);
    setStepIndex(0);
    setState("editing");
    setError(null);
    setSaved(null);
    setDuplicates([]);
    setSuggestedBestId(null);
    setAwaitingReview(false);
  }, [setImage]);

  return {
    draft,
    step,
    stepIndex,
    total: STEPS.length,
    isLast: stepIndex === STEPS.length - 1,
    preview,
    blocker: touched ? blocker : null,
    canAdvance: !blocker,
    state,
    error,
    saved,
    duplicates,
    suggestedBestId,
    awaitingReview,
    set,
    setImage,
    next,
    back,
    goTo: setStepIndex,
    submit,
    reset,
  };
}

export function rejectReason(file) {
  if (!file.type.startsWith("image/")) return "image";
  if (file.size > MAX_BYTES) return "size";
  return null;
}
