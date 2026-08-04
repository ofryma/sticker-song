const BASE = "/api";

async function unwrap(response) {
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

/** Absolute path for an entry's photo, ready for an <img src>. */
export function imageUrl(entry) {
  return `${BASE}${entry.image_url}`;
}
