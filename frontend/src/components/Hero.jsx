import { useI18n } from "../i18n/index.jsx";
import { pluralCount } from "../lib/format.js";
import { Candle } from "./Candle.jsx";
import { Action } from "./ui/Action.jsx";

/**
 * Opening screen: a single candle in the dark, the title, and a very slow
 * drifting field of light behind it. Nothing here moves quickly.
 */
export function Hero({ count }) {
  const { t } = useI18n();

  return (
    <section className="relative flex min-h-[82svh] flex-col items-center justify-center overflow-hidden px-5 pb-16 pt-10 text-center sm:min-h-[86vh] sm:pb-24 sm:pt-16">
      {/* Two drifting pools of light — the room, not a background image. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-drift bg-[radial-gradient(45%_38%_at_50%_28%,rgba(240,190,107,0.13),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-drift bg-[radial-gradient(55%_45%_at_28%_78%,rgba(0,56,184,0.16),transparent_72%)]"
        style={{ animationDelay: "-19s" }}
      />

      <div className="relative flex flex-col items-center">
        <Candle size={44} className="animate-fade-slow sm:hidden" />
        <Candle size={54} className="hidden animate-fade-slow sm:inline-flex" />

        <p className="eyebrow mt-9 animate-fade sm:mt-12" style={{ animationDelay: "500ms" }}>
          {t("home.kicker")}
        </p>

        <h1
          className="mt-5 max-w-3xl animate-rise font-display text-[2.1rem] leading-[1.18] text-stone-50 sm:mt-6 sm:text-6xl"
          style={{ animationDelay: "900ms" }}
        >
          {t("home.title")}
        </h1>

        <p
          className="mt-6 max-w-xl animate-rise text-[0.95rem] leading-relaxed text-stone-300/90 sm:mt-8 sm:text-lg"
          style={{ animationDelay: "1500ms" }}
        >
          {t("home.subtitle")}
        </p>

        <div
          className="mt-10 flex w-full max-w-xs animate-rise flex-col items-stretch gap-3 sm:mt-12 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:gap-4"
          style={{ animationDelay: "2100ms" }}
        >
          <Action to="/wall" size="lg" className="w-full sm:w-auto">
            {t("home.cta")}
          </Action>
          <Action tone="ghost" to="/contribute" size="lg" className="w-full sm:w-auto">
            {t("home.ctaSecondary")}
          </Action>
        </div>

        {count != null && (
          <p
            className="mt-12 animate-fade text-xs uppercase tracking-memorial text-stone-500"
            style={{ animationDelay: "2600ms" }}
          >
            {pluralCount(t, "home.count", count)}
          </p>
        )}
      </div>
    </section>
  );
}
