import { useState } from "react";
import { Textarea } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { Action } from "../ui/Action.jsx";

/**
 * The decision, and the note that is kept with it. Mount it with `key={entry.id}`
 * so a half-typed note never follows the reviewer to the next submission.
 */
export function DecisionBar({ entry, busy, onAct }) {
  const { t } = useI18n();
  const [note, setNote] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const pending = entry.status === "pending";

  return (
    <div className="w-full">
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
              onPress={() => onAct("publish", entry.id, note)}
            >
              {t("admin.publish")}
            </Action>
            <Action
              tone="ghost"
              size="sm"
              isDisabled={busy}
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
            onPress={() => onAct("publish", entry.id, "")}
          >
            {t("admin.publishAnyway")}
          </Action>
        )}
        {entry.status === "published" && (
          <Action
            tone="ghost"
            size="sm"
            isDisabled={busy}
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
            <Action tone="quiet" size="sm" onPress={() => setConfirmingDelete(true)}>
              {t("admin.delete")}
            </Action>
          )}
        </div>
      </div>
    </div>
  );
}
