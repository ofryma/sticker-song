export const BASE = "/api";

export async function unwrap(response) {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      // keep statusText
    }
    throw new Error(detail);
  }
  return response.json();
}

/** Liveness, and which build is answering — `{ status, version }`. */
export async function getHealth() {
  return unwrap(await fetch(`${BASE}/health`));
}

export async function listEntries({ limit = 100, offset = 0 } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return unwrap(await fetch(`${BASE}/entries?${query}`));
}

export async function getEntry(id) {
  return unwrap(await fetch(`${BASE}/entries/${id}`));
}

export async function createEntry({ image, personName, stickerText, latitude, longitude }) {
  const form = new FormData();
  form.append("image", image);
  form.append("person_name", personName);
  form.append("sticker_text", stickerText);
  if (latitude != null && longitude != null) {
    form.append("latitude", String(latitude));
    form.append("longitude", String(longitude));
  }
  return unwrap(await fetch(`${BASE}/entries`, { method: "POST", body: form }));
}

/**
 * Who the archive already remembers under a name — asked from the name step of
 * the wizard, before a photograph is uploaded, so a second record for the same
 * person can be avoided rather than merged away afterwards.
 */
export async function findNameMatches(name) {
  const query = new URLSearchParams({ name });
  return unwrap(await fetch(`${BASE}/entries/matches?${query}`));
}

/**
 * Records the backend thinks may be the same person, plus which of the images
 * is highest resolution. Fuzzy hits are suggestions for a human to judge.
 */
export async function getDuplicates(id) {
  return unwrap(await fetch(`${BASE}/entries/${id}/duplicates`));
}

/** Vote that this image is the best one for its person. 409 if already voted. */
export async function voteForImage(id) {
  const response = await fetch(`${BASE}/entries/${id}/feedback`, { method: "POST" });
  if (response.status === 409) {
    const already = new Error("already-voted");
    already.code = "already-voted";
    throw already;
  }
  return unwrap(response);
}

/**
 * Write to whoever keeps the archive: a suggestion, a bug, or a problem with a
 * sticker. Nothing to do with `voteForImage` above, which answers exactly one
 * question about one photograph.
 *
 * `website` is the honeypot — a field no person ever sees. It is sent empty and
 * the backend drops anything that arrives with it filled in.
 */
export async function sendMessage({ kind, body, entryId = null, replyEmail = "", website = "" }) {
  return unwrap(
    await fetch(`${BASE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        body,
        entry_id: entryId,
        reply_email: replyEmail || null,
        website,
      }),
    }),
  );
}

/** Absolute path for an entry's photo, ready for an <img src>. */
export function imageUrl(entry) {
  return `${BASE}${entry.image_url}`;
}

/**
 * The small copy, for grids and the collage — a wall of full-size webp is a heavy
 * payload on a phone for pixels nobody sees. Older entries without a stored
 * thumbnail fall back to the full image server-side, so this is always safe.
 */
export function thumbUrl(entry) {
  return `${BASE}${entry.thumb_url ?? entry.image_url}`;
}
