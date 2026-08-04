import { useI18n } from "../../i18n/index.jsx";
import { Action } from "../ui/Action.jsx";
import { Candle } from "../Candle.jsx";

/** After a successful save. Gratitude, the name, and a way onward — no fanfare. */
export function Thanks({ entry, onAnother, onView }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center gap-8 py-16 text-center animate-fade-slow">
      <Candle size={44} />
      <div>
        <h2 className="font-display text-3xl text-stone-50 sm:text-4xl">{t("contribute.thanksTitle")}</h2>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-stone-400">
          {t("contribute.thanksLead", { name: entry.person_name })}
        </p>
      </div>
      <hr className="rule-fade max-w-xs" />
      <div className="flex flex-col gap-4 sm:flex-row">
        <Action onPress={onView}>{t("contribute.thanksView")}</Action>
        <Action tone="ghost" onPress={onAnother}>
          {t("contribute.thanksAnother")}
        </Action>
      </div>
      <Action tone="quiet" size="sm" to="/wall" className="text-xs tracking-memorial uppercase">
        {t("nav.wall")}
      </Action>
    </div>
  );
}
