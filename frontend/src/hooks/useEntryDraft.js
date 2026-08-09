import { useCallback, useEffect, useState } from "react";

/**
 * What a reviewer is changing on one entry, and whether anything has changed.
 *
 * Everything is held as text, exactly as it is typed — a coordinate mid-edit is
 * not a number yet — and turned back into values only when the patch is built.
 * The patch carries the changed fields alone, so a form that touched a name
 * cannot blank a location it never showed.
 *
 * The draft re-reads the entry whenever the saved row changes, so what is on
 * screen after a save is what the archive actually kept — including a name the
 * backend tidied on the way in.
 */

const coordText = (value) => (value == null ? "" : String(value));

function formOf(entry) {
  return {
    person_name: entry?.person_name ?? "",
    sticker_text: entry?.sticker_text ?? "",
    latitude: coordText(entry?.latitude),
    longitude: coordText(entry?.longitude),
    review_note: entry?.review_note ?? "",
  };
}

/** A coordinate as typed: blank means "no location", anything else must be a
 *  number inside its range. Returns `{ value }` or `{ error }`. */
function coordOf(text, limit) {
  const trimmed = text.trim();
  if (trimmed === "") return { value: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || Math.abs(value) > limit) return { error: "coords" };
  return { value };
}

/** What is wrong with the form, by field. A name and a transcription are the
 *  two things an entry cannot be without. */
function problemsIn(form) {
  const problems = {};
  if (!form.person_name.trim()) problems.person_name = "required";
  if (!form.sticker_text.trim()) problems.sticker_text = "required";
  if (coordOf(form.latitude, 90).error) problems.latitude = "coords";
  if (coordOf(form.longitude, 180).error) problems.longitude = "coords";
  return problems;
}

/** The fields that differ from the saved entry, ready to send. */
function patchOf(form, entry) {
  if (!entry) return {};
  const patch = {};
  const name = form.person_name.trim();
  const text = form.sticker_text.trim();
  const note = form.review_note.trim();

  if (name !== (entry.person_name ?? "")) patch.person_name = name;
  if (text !== (entry.sticker_text ?? "")) patch.sticker_text = text;
  if (note !== (entry.review_note ?? "")) patch.review_note = note || null;

  const latitude = coordOf(form.latitude, 90);
  const longitude = coordOf(form.longitude, 180);
  if (!latitude.error && latitude.value !== (entry.latitude ?? null)) {
    patch.latitude = latitude.value;
  }
  if (!longitude.error && longitude.value !== (entry.longitude ?? null)) {
    patch.longitude = longitude.value;
  }
  return patch;
}

export function useEntryDraft(entry) {
  const [form, setForm] = useState(() => formOf(entry));
  // The replacement photograph, and the object URL the preview is drawn from.
  const [photo, setPhoto] = useState(null);

  const pickPhoto = useCallback((file) => {
    setPhoto(file ? { file, url: URL.createObjectURL(file) } : null);
  }, []);

  // The preview's URL is let go when it stops being the preview, whether that
  // is another photograph, a saved one, or the drawer closing.
  useEffect(() => {
    if (!photo) return undefined;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  const id = entry?.id ?? null;
  const savedAt = entry?.updated_at ?? null;
  const [read, setRead] = useState({ id, savedAt });

  // Re-read on a different entry, and again once the saved row has moved on —
  // adjusted while rendering rather than in an effect, so the fields are never
  // painted holding the values the archive has already replaced.
  if (read.id !== id || read.savedAt !== savedAt) {
    setRead({ id, savedAt });
    setForm(formOf(entry));
    setPhoto(null);
  }

  const set = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const discard = useCallback(() => {
    setForm(formOf(entry));
    setPhoto(null);
  }, [entry]);

  const patch = patchOf(form, entry);
  const problems = problemsIn(form);
  const dirty = Object.keys(patch).length > 0 || photo !== null;

  return {
    form,
    set,
    photo,
    pickPhoto,
    patch,
    problems,
    dirty,
    /** Something to save, and nothing in the way of saving it. */
    savable: dirty && Object.keys(problems).length === 0,
    discard,
  };
}
