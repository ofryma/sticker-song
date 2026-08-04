import { useState } from "react";
import { voteForImage } from "../../lib/api.js";
import { useI18n } from "../../i18n/index.jsx";
import { DuplicateCard } from "./DuplicateCard.jsx";
import { Action } from "../ui/Action.jsx";

/**
 * Shown after a save when the backend suspects the same person is already in
 * the archive. The visitor picks the clearest photograph; enough votes and the
 * backend merges the exact-name duplicates away.
 */
export function DuplicateReview({ entry, duplicates, suggestedBestId, onSkip }) {
  const { t } = useI18n();
  const [chosen, setChosen] = useState(null);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);

  const choose = async (id) => {
    setChosen(id);
    setNotice(null);
    try {
      setResult(await voteForImage(id));
    } catch (cause) {
      setNotice(cause.code === "already-voted" ? t("duplicates.voted") : t("common.error"));
    }
  };

  // The new entry is compared alongside the candidates, never against them.
  const options = [{ ...entry, vote_count: 0, is_exact_match: true, mine: true }, ...duplicates];

  return (
    <section className="mt-16 border-t border-night-line/70 pt-12 animate-fade">
      <p className="eyebrow mb-4">{t("contribute.kicker")}</p>
      <h3 className="font-display text-2xl text-stone-50">{t("duplicates.title")}</h3>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-stone-400">{t("duplicates.lead")}</p>

      <ul className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {options.map((option) => (
          <DuplicateCard
            key={option.id}
            entry={option}
            mine={Boolean(option.mine)}
            suggested={option.id === suggestedBestId}
            chosen={chosen === option.id}
            disabled={Boolean(chosen)}
            onChoose={choose}
          />
        ))}
      </ul>

      {notice && <p className="mt-6 animate-fade text-sm text-stone-400">{notice}</p>}

      {result && (
        <div className="mt-8 animate-fade rounded-sm border border-flame/30 bg-flame/[0.05] px-5 py-4">
          <p className="text-sm text-flame-glow">
            {result.resolved
              ? t("duplicates.resolvedTitle")
              : t("duplicates.progress", { n: result.vote_count, threshold: result.threshold })}
          </p>
          {result.resolved && (
            <p className="mt-2 text-xs leading-relaxed text-stone-400">
              {t("duplicates.resolvedLead")}
            </p>
          )}
        </div>
      )}

      {!chosen && (
        <Action tone="quiet" size="sm" onPress={onSkip} className="mt-8">
          {t("duplicates.skip")}
        </Action>
      )}
    </section>
  );
}
