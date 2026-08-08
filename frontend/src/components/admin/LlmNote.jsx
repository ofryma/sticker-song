import { useI18n } from "../../i18n/index.jsx";
import { Action } from "../ui/Action.jsx";

/* Sun for "look closely", olive for "nothing caught my eye". Never red: a flag is
   a note for the reviewer, not a verdict on the person. */
const TONES = {
  flag: "border-sun/50 bg-sun-pale/60 text-sun-deep",
  ok: "border-olive/40 bg-olive-pale/50 text-olive-deep",
  error: "border-day-line bg-day-warm/70 text-ink-soft",
};

/**
 * What the model made of the submitted text. Advisory: it is shown next to the
 * buttons, never instead of them, and it decides nothing.
 */
export function LlmNote({ entry, onReanalyze, busy }) {
  const { t } = useI18n();
  const verdict = entry.llm_verdict;

  if (!verdict) {
    return (
      <div className="rounded-sm border border-day-line bg-day-warm/60 px-4 py-3">
        <p className="text-xs leading-relaxed text-ink-muted">{t("admin.llm.none")}</p>
        <Action tone="quiet" size="sm" onPress={onReanalyze} isLoading={busy} className="mt-2">
          {t("admin.llm.run")}
        </Action>
      </div>
    );
  }

  return (
    <div className={`rounded-sm border px-4 py-3 ${TONES[verdict] ?? TONES.error}`}>
      <p className="text-xs tracking-label uppercase">{t(`admin.llm.${verdict}`)}</p>
      {entry.llm_reason && (
        <p className="mt-2 text-xs leading-relaxed break-words">{entry.llm_reason}</p>
      )}
      <p className="mt-2 text-[0.65rem] leading-relaxed text-ink-muted">
        {t("admin.llm.advisory")}
      </p>
      <Action tone="quiet" size="sm" onPress={onReanalyze} isLoading={busy} className="mt-1">
        {t("admin.llm.again")}
      </Action>
    </div>
  );
}
