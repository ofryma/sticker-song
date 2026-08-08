import { useI18n } from "../i18n/index.jsx";
import { Page } from "../components/Section.jsx";
import { Sprig } from "../components/Sprig.jsx";
import { Action } from "../components/ui/Action.jsx";

/** A wrong address. Says so plainly and points back to the wall. */
export default function NotFound() {
  const { t } = useI18n();

  return (
    <Page className="max-w-xl pb-24">
      <div className="animate-fade-slow flex flex-col items-center gap-7 py-16 text-center">
        <Sprig size={38} className="animate-unfurl" />
        <div>
          <p className="eyebrow mb-4">{t("notFound.kicker")}</p>
          <h1 className="font-display text-ink text-3xl sm:text-4xl">{t("notFound.title")}</h1>
          <p className="text-ink-muted mx-auto mt-5 max-w-sm text-sm leading-relaxed">
            {t("notFound.lead")}
          </p>
        </div>
        <hr className="rule-fade max-w-xs" />
        <div className="flex flex-col gap-4 sm:flex-row">
          <Action to="/wall">{t("nav.wall")}</Action>
          <Action tone="ghost" to="/">
            {t("nav.home")}
          </Action>
        </div>
      </div>
    </Page>
  );
}
