import { useState } from "react";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { formatDate } from "../../lib/format.js";
import { useEntryDraft } from "../../hooks/useEntryDraft.js";
import { DecisionBar } from "./DecisionBar.jsx";
import { EditBar } from "./EditBar.jsx";
import { EntryFields } from "./EntryFields.jsx";
import { EntryPhoto } from "./EntryPhoto.jsx";
import { LlmNote } from "./LlmNote.jsx";

/**
 * One submission in full, opened from a row, and editable in place: the
 * photograph, the name, the words, the location, the note. Nothing is written
 * until the reviewer keeps it — see `EditBar`.
 *
 * The contents mount only while the drawer is open, so a photograph is fetched
 * when a reviewer asks for it and not thirty at a time on the way past.
 */
function Contents({ entry, token, busy, onAct, onSave, onReanalyze }) {
  const { t, locale } = useI18n();
  const draft = useEntryDraft(entry);
  const [failure, setFailure] = useState(null);

  const keep = async () => {
    setFailure(null);
    const { ok, error } = await onSave(entry.id, {
      patch: draft.patch,
      file: draft.photo?.file ?? null,
    });
    if (!ok) setFailure(error ?? new Error(""));
  };

  const discard = () => {
    setFailure(null);
    draft.discard();
  };

  return (
    <>
      <DrawerHeader className="border-day-line/70 bg-day-soft/70 flex-col items-start gap-1 border-b">
        <p className="eyebrow">{t(`admin.status.${entry.status}`)}</p>
        <h2 className="text-ink font-serif text-2xl leading-tight break-words">
          {entry.person_name}
        </h2>
      </DrawerHeader>

      <DrawerBody className="gap-6 py-6">
        <EntryPhoto entry={entry} token={token} draft={draft} />

        <EntryFields draft={draft} />

        <dl className="text-ink-muted flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div>
            <dt className="sr-only">{t("entry.added")}</dt>
            <dd>
              <time dateTime={entry.created_at}>{formatDate(entry.created_at, locale)}</time>
            </dd>
          </div>
          <div>
            <dt className="sr-only">{t("admin.resolution")}</dt>
            <dd>
              {entry.image_width}×{entry.image_height}
            </dd>
          </div>
        </dl>

        <LlmNote entry={entry} onReanalyze={() => onReanalyze(entry.id)} busy={busy} />
      </DrawerBody>

      <DrawerFooter className="border-day-line/70 bg-day-soft/60 flex-col items-stretch gap-4 border-t">
        <EditBar draft={draft} busy={busy} error={failure} onSave={keep} onDiscard={discard} />
        {/* A decision on an entry that is half-corrected would keep the version
            nobody meant, so the changes are settled first. */}
        <DecisionBar key={entry.id} entry={entry} busy={busy} blocked={draft.dirty} onAct={onAct} />
      </DrawerFooter>
    </>
  );
}

export function ReviewDrawer({ entry, token, busy, onClose, onAct, onSave, onReanalyze }) {
  return (
    <Drawer
      isOpen={Boolean(entry)}
      onOpenChange={(open) => !open && onClose()}
      placement="right"
      size="lg"
      radius="none"
      // A working panel, not a dialog: the queue stays visible and scrollable
      // beside it, and the motion is short enough to stay out of the way. The
      // unhurried timings this project uses elsewhere are for visitors.
      backdrop="transparent"
      shouldBlockScroll={false}
      classNames={{
        base: "bg-day border-s border-day-line shadow-lg",
        closeButton: "text-ink-muted top-4 end-4",
      }}
      motionProps={{
        variants: {
          enter: { opacity: 1, x: 0, transition: { duration: 0.18, ease: "easeOut" } },
          exit: { opacity: 0, x: 24, transition: { duration: 0.12, ease: "easeOut" } },
        },
      }}
    >
      <DrawerContent>
        {entry && (
          // Keyed on the entry, so a half-typed correction never follows the
          // reviewer to the next submission.
          <Contents
            key={entry.id}
            entry={entry}
            token={token}
            busy={busy}
            onAct={onAct}
            onSave={onSave}
            onReanalyze={onReanalyze}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}
