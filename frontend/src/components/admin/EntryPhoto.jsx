import { useRef, useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { rejectReason } from "../../hooks/useStickerDraft.js";
import { reviewImageUrl } from "../../lib/admin.js";
import { Action } from "../ui/Action.jsx";
import { Glyph } from "../ui/Glyph.jsx";
import { PhotoEditor } from "../contribute/PhotoEditor.jsx";

/** One of the actions under the photograph, drawn rather than named. */
function PhotoAction({ icon, label, onPress }) {
  return (
    <Action tone="quiet" isIconOnly size="sm" onPress={onPress} aria-label={label} title={label}>
      <Glyph name={icon} className="h-[1.15rem] w-[1.15rem]" />
    </Action>
  );
}

/**
 * The photograph on an entry, and the two ways to change it: straighten and
 * frame the one that is here, or put a different one in its place. Both go
 * through the same editor a contributor uses, so a reviewer fixing a sideways
 * photograph works with exactly the tools that took it.
 *
 * Nothing is uploaded here. A chosen photograph is held in the draft and kept —
 * or dropped — with the rest of the changes.
 */
export function EntryPhoto({ entry, token, draft }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [rejected, setRejected] = useState(null);

  const of = (size) => reviewImageUrl({ token, id: entry.id, size, version: entry.updated_at });
  // The small copy is enough to look at in a drawer; an edit is applied to the
  // pixels that are actually kept, so it reaches for the full-size object — a
  // crop of a thumbnail would throw most of the photograph away.
  const shown = draft.photo?.url ?? of("thumb");
  const full = draft.photo?.url ?? of("image");

  const accept = (file) => {
    if (!file) return;
    const reason = rejectReason(file);
    setRejected(reason);
    if (!reason) draft.pickPhoto(file);
  };

  const edited = (file) => {
    setEditing(false);
    accept(file);
  };

  return (
    <figure className="animate-fade">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => accept(event.target.files?.[0])}
      />

      <img
        src={shown}
        alt={t("entry.photo", { name: entry.person_name })}
        decoding="async"
        className="border-day-line bg-day-warm w-full rounded-sm border object-contain"
      />

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2">
        <PhotoAction icon="crop" label={t("contribute.crop")} onPress={() => setEditing(true)} />
        <PhotoAction
          icon="swap"
          label={t("admin.edit.replacePhoto")}
          onPress={() => inputRef.current?.click()}
        />
        <PhotoAction
          icon="expand"
          label={t("admin.openFull")}
          onPress={() => window.open(full, "_blank", "noreferrer")}
        />
        {draft.photo && (
          <span className="ms-auto flex items-center gap-2">
            <span className="text-olive-deep text-xs">{t("admin.edit.photoChanged")}</span>
            <Action tone="quiet" size="sm" onPress={() => draft.pickPhoto(null)}>
              {t("admin.edit.photoKeep")}
            </Action>
          </span>
        )}
      </figcaption>

      {rejected && (
        <p className="text-sun-deep mt-3 animate-fade text-sm">
          {t(rejected === "size" ? "contribute.tooLarge" : "contribute.notImage")}
        </p>
      )}

      <PhotoEditor
        isOpen={editing}
        src={full}
        name={`${entry.id}.jpg`}
        onApply={edited}
        onClose={() => setEditing(false)}
      />
    </figure>
  );
}
