import { useState } from "react";
import { Textarea } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { Action } from "../ui/Action.jsx";

/**
 * The decision, and the note that is kept with it. Mount it with `key={entry.id}`
 * so a half-typed note never follows the reviewer to the next submission.
 */
export function DecisionBar({ entry, busy, blocked = false, onAct }) {
  const { t } = useI18n();
  const [note, setNote] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const pending = entry.status === "pending";
  // Deciding on an entry that is half-corrected would keep the version nobody
  // meant, so while changes are waiting the decision waits with them.
  const stop = busy || blocked;

  return (
    <div className="w-full">
      {blocked && (
        <p className="text-ink-muted animate-fade mb-3 text-xs">{t("admin.edit.decideAfter")}</p>
      )}
      {pending && (
        <Textarea
          value={note}
          onValueChange={setNote}
          aria-label={t("admin.noteLabel")}
          placeholder={t("admin.notePlaceholder")}
          minRows={1}
          maxRows={4}
          radius="sm"
          variant="bordered"
          classNames={{
            input: "text-sm",
            inputWrapper: "border-day-line bg-day-soft/70",
          }}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {pending && (
          <>
            <Action
              tone="leaf"
              size="sm"
              isLoading={busy}
              isDisabled={stop}
              onPress={() => onAct("publish", entry.id, note)}
            >
              {t("admin.publish")}
            </Action>
            <Action
              tone="ghost"
              size="sm"
              isDisabled={stop}
              onPress={() => onAct("reject", entry.id, note)}
            >
              {t("admin.reject")}
            </Action>
          </>
        )}
        {entry.status === "rejected" && (
          <Action
            tone="leaf"
            size="sm"
            isLoading={busy}
            isDisabled={stop}
            onPress={() => onAct("publish", entry.id, "")}
          >
            {t("admin.publishAnyway")}
          </Action>
        )}
        {entry.status === "published" && (
          <Action
            tone="ghost"
            size="sm"
            isDisabled={stop}
            onPress={() => onAct("reject", entry.id, "")}
          >
            {t("admin.takeOffWall")}
          </Action>
        )}

        {/* Two steps rather than a dialog: this one has no undo. */}
        <div className="ms-auto flex items-center gap-3">
          {confirmingDelete ? (
            <>
              <span className="text-sun-deep text-xs">{t("admin.deleteWarning")}</span>
              <Action
                tone="quiet"
                size="sm"
                isLoading={busy}
                isDisabled={stop}
                onPress={() => onAct("delete", entry.id)}
                className="text-sun-deep"
              >
                {t("admin.deleteConfirm")}
              </Action>
              <Action tone="quiet" size="sm" onPress={() => setConfirmingDelete(false)}>
                {t("admin.cancel")}
              </Action>
            </>
          ) : (
            <Action
              tone="quiet"
              size="sm"
              isDisabled={stop}
              onPress={() => setConfirmingDelete(true)}
            >
              {t("admin.delete")}
            </Action>
          )}
        </div>
      </div>
    </div>
  );
}
