import { useI18n } from "../../i18n/index.jsx";
import { Action } from "../ui/Action.jsx";
import { Sprig } from "../Sprig.jsx";

/**
 * After a successful save. Gratitude, the name, and a way onward — no fanfare.
 *
 * A submission waits for review before it reaches the wall, so `awaitingReview`
 * says so plainly: the record is kept, and a person will read it through.
 */
export function Thanks({ entry, onAnother, onView, awaitingReview = false }) {
  const { t } = useI18n();
  const key = awaitingReview ? "contribute.thanksPending" : "contribute.thanks";

  return (
    /* Centred in whatever height the page has, by auto margins rather than
       `justify-center`: on a small phone the margins simply collapse, so a long
       message is still reachable instead of being clipped at the top. */
    <div className="flex min-h-0 flex-1 flex-col max-sm:overflow-y-auto">
      <div className="m-auto flex flex-col items-center gap-6 py-8 text-center animate-fade-slow sm:gap-8 sm:py-16">
        <Sprig size={40} sizeSm={46} className="animate-unfurl" />
        <div>
          <h2 className="font-display text-3xl text-ink sm:text-4xl">{t(`${key}Title`)}</h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-muted sm:mt-5">
            {t(`${key}Lead`, { name: entry.person_name })}
          </p>
          {awaitingReview && (
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              {t("contribute.thanksPendingHint")}
            </p>
          )}
        </div>
        <hr className="rule-fade max-w-xs" />
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Action onPress={onView}>{t("contribute.thanksView")}</Action>
          <Action tone="ghost" onPress={onAnother}>
            {t("contribute.thanksAnother")}
          </Action>
        </div>
        <Action tone="quiet" size="sm" to="/wall" className="text-xs tracking-label uppercase">
          {t("nav.wall")}
        </Action>
      </div>
    </div>
  );
}
