import { useI18n } from "../i18n/index.jsx";
import { Page, Section } from "../components/Section.jsx";
import { Candle } from "../components/Candle.jsx";
import { Action } from "../components/ui/Action.jsx";

export default function About() {
  const { t, dict } = useI18n();

  return (
    <Page className="max-w-2xl">
      <header className="mb-14 animate-rise">
        <p className="eyebrow mb-4">{t("about.kicker")}</p>
        <h1 className="font-display text-3xl leading-tight text-stone-50 sm:text-4xl">
          {t("about.title")}
        </h1>
      </header>

      <Section className="space-y-7">
        {dict.about.body.map((paragraph) => (
          <p key={paragraph} className="font-serif text-lg leading-loose text-stone-300">
            {paragraph}
          </p>
        ))}
      </Section>

      <Section className="mt-20">
        <hr className="rule-fade mb-12" />
        <h2 className="font-display text-2xl text-stone-50">{t("about.guidelinesTitle")}</h2>
        <ul className="mt-8 space-y-5">
          {dict.about.guidelines.map((line) => (
            <li key={line} className="flex gap-4 text-sm leading-relaxed text-stone-400">
              <span aria-hidden="true" className="mt-1.5 text-flame/60">
                ◈
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="mt-24 flex flex-col items-center gap-7 text-center">
        <Candle size={34} />
        <Action to="/contribute" size="lg">
          {t("nav.contribute")}
        </Action>
      </Section>
    </Page>
  );
}
