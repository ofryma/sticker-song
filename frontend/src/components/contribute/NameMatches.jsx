import { useI18n } from "../../i18n/index.jsx";
import { Action } from "../ui/Action.jsx";
import { Sprig } from "../Sprig.jsx";
import { MatchCard } from "./MatchCard.jsx";

/** One way onward: what it means, and the words on the button. */
function Choice({ title, hint, label, tone, onPress }) {
  return (
    <div className="flex flex-col gap-2 border-t border-day-line/70 pt-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{hint}</p>
      </div>
      <Action tone={tone} size="sm" onPress={onPress} className="shrink-0 max-sm:w-full">
        {label}
      </Action>
    </div>
  );
}

/**
 * Between the name and the rest of the wizard, when the archive already holds
 * a name like this one: the stickers that are here, and three honest ways on —
 * leave the archive as it is, carry on because this is somebody else, or add
 * this photograph alongside the one that is here.
 *
 * Only the first ends the submission. The other two go straight on with the
 * draft as it stands: a near match is a question, and answering it must never
 * cost somebody the photograph and the name they have already given.
 */
export function NameMatches({ name, matches, hasExact, onKeep, onOther, onContinue }) {
  const { t } = useI18n();

  return (
    <div className="animate-rise">
      <p className="eyebrow mb-4">{t("nameMatch.kicker")}</p>
      <h2 className="font-display text-2xl text-ink sm:text-3xl">
        {t("nameMatch.title", { name })}
      </h2>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-muted">
        {t(hasExact ? "nameMatch.leadExact" : "nameMatch.leadSimilar")}
      </p>

      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {matches.map((entry) => (
          <MatchCard key={entry.id} entry={entry} />
        ))}
      </ul>

      <div className="mt-10 flex flex-col gap-5">
        <Choice
          title={t("nameMatch.keepTitle")}
          hint={t("nameMatch.keepHint")}
          label={t("nameMatch.keepAction")}
          onPress={onKeep}
        />
        <Choice
          title={t("nameMatch.otherTitle")}
          hint={t("nameMatch.otherHint")}
          label={t("nameMatch.otherAction")}
          tone="ghost"
          onPress={onOther}
        />
        <Choice
          title={t("nameMatch.continueTitle")}
          hint={t("nameMatch.continueHint")}
          label={t("nameMatch.continueAction")}
          tone="ghost"
          onPress={onContinue}
        />
      </div>
    </div>
  );
}

/**
 * After choosing the sticker that was already here. The upload is let go of,
 * which is a contribution in itself — the person is remembered once, well — so
 * the thanks are the same unhurried thanks a submission gets.
 */
export function MatchKept({ name, onRestart }) {
  const { t } = useI18n();

  return (
    <div className="m-auto flex flex-col items-center gap-6 py-8 text-center animate-fade-slow sm:gap-8 sm:py-16">
      <Sprig size={40} sizeSm={46} className="animate-unfurl" />
      <div>
        <h2 className="font-display text-3xl text-ink sm:text-4xl">{t("nameMatch.keptTitle")}</h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-muted sm:mt-5">
          {t("nameMatch.keptLead", { name })}
        </p>
      </div>
      <hr className="rule-fade max-w-xs" />
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Action onPress={onRestart}>{t("contribute.thanksAnother")}</Action>
      </div>
      <Action tone="quiet" size="sm" to="/wall" className="text-xs tracking-label uppercase">
        {t("nav.wall")}
      </Action>
    </div>
  );
}
