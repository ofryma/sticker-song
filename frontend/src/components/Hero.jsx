import { useI18n } from "../i18n/index.jsx";
import { pluralCount } from "../lib/format.js";
import { Sprig } from "./Sprig.jsx";
import { Action } from "./ui/Action.jsx";
import { AddSticker } from "./ui/AddSticker.jsx";

/**
 * Opening screen: a single leaf in open daylight, the title, and two very slow
 * drifting pools of light behind it. Nothing here moves quickly.
 */
export function Hero({ count }) {
  const { t } = useI18n();

  return (
    <section className="relative flex min-h-[82svh] flex-col items-center justify-center overflow-hidden px-5 pb-16 pt-10 text-center sm:min-h-[86vh] sm:pb-24 sm:pt-16">
      {/* Two drifting pools of daylight — sun above, olive below. */}
      <div
        aria-hidden="true"
        className="animate-drift pointer-events-none absolute inset-0 bg-[radial-gradient(45%_38%_at_50%_26%,rgba(224,160,60,0.20),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="animate-drift pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_28%_78%,rgba(107,143,63,0.16),transparent_72%)]"
        style={{ animationDelay: "-19s" }}
      />

      <div className="relative flex flex-col items-center">
        <Sprig size={46} sizeSm={58} className="animate-unfurl" />

        <p className="eyebrow mt-9 animate-fade sm:mt-12" style={{ animationDelay: "500ms" }}>
          {t("home.kicker")}
        </p>

        <h1
          className="mt-5 max-w-3xl animate-rise font-display text-[2.1rem] leading-[1.18] text-ink sm:mt-6 sm:text-6xl"
          style={{ animationDelay: "900ms" }}
        >
          {t("home.title")}
        </h1>

        <p
          className="mt-6 max-w-xl animate-rise text-[0.95rem] leading-relaxed text-ink-soft sm:mt-8 sm:text-lg"
          style={{ animationDelay: "1500ms" }}
        >
          {t("home.subtitle")}
        </p>

        <div
          className="mt-10 flex w-full max-w-xs animate-rise flex-col items-stretch gap-3 sm:mt-12 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:gap-4"
          style={{ animationDelay: "2100ms" }}
        >
          {/* Where two actions sit together, the solid one is always this one. */}
          <AddSticker size="lg" className="w-full sm:w-auto" />
          <Action tone="ghost" to="/wall" size="lg" className="w-full sm:w-auto">
            {t("home.cta")}
          </Action>
        </div>

        {count != null && (
          <p
            className="mt-12 animate-fade text-xs uppercase tracking-label text-ink-muted"
            style={{ animationDelay: "2600ms" }}
          >
            {pluralCount(t, "home.count", count)}
          </p>
        )}
      </div>
    </section>
  );
}
