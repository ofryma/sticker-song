import { useI18n } from "../../i18n/index.jsx";
import { Action } from "../ui/Action.jsx";
import { Sprig } from "../Sprig.jsx";

/**
 * After a message is sent. Thanks, and a way onward — nothing counted, no
 * reference number, nothing to do next.
 */
export function ContactThanks() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center animate-fade-slow sm:gap-8 sm:py-20">
      <Sprig size={40} sizeSm={46} className="animate-unfurl" />
      <div>
        <h2 className="font-display text-3xl text-ink sm:text-4xl">{t("contact.thanksTitle")}</h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-muted sm:mt-5">
          {t("contact.thanksLead")}
        </p>
      </div>
      <hr className="rule-fade max-w-xs" />
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Action to="/wall">{t("contact.thanksWall")}</Action>
        <Action tone="ghost" to="/">
          {t("contact.thanksHome")}
        </Action>
      </div>
    </div>
  );
}
