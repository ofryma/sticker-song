import { useI18n } from "../../i18n/index.jsx";
import { Action } from "../ui/Action.jsx";

/**
 * What is waiting to be kept. It appears only once something has actually
 * changed, says so plainly, and offers the two answers: keep it, or put the
 * entry back the way it was.
 */
export function EditBar({ draft, busy, error, onSave, onDiscard }) {
  const { t } = useI18n();

  if (!draft.dirty) return null;

  return (
    <div className="animate-fade w-full">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-ink-soft text-sm">{t("admin.edit.unsaved")}</p>
        <div className="ms-auto flex items-center gap-3">
          <Action tone="quiet" size="sm" onPress={onDiscard} isDisabled={busy}>
            {t("admin.edit.discard")}
          </Action>
          <Action
            tone="primary"
            size="sm"
            onPress={onSave}
            isLoading={busy}
            isDisabled={!draft.savable}
          >
            {t("admin.edit.save")}
          </Action>
        </div>
      </div>

      {error && (
        <p className="text-sun-deep animate-fade mt-3 text-xs leading-relaxed">
          {t("admin.edit.failed", { reason: error.message })}
        </p>
      )}
    </div>
  );
}
