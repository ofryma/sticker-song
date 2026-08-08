import { useI18n } from "../i18n/index.jsx";
import { useEntries } from "../hooks/useEntries.js";
import { Hero } from "../components/Hero.jsx";
import { Page, Section, SectionHeading } from "../components/Section.jsx";
import { AddSticker } from "../components/ui/AddSticker.jsx";

// One wide page, so the hero can state a real total instead of a page size.
const SCAN = 200;

function Steps() {
  const { dict } = useI18n();
  return (
    <ol className="grid gap-px overflow-hidden rounded-sm border border-day-line/70 bg-day-line/70 sm:grid-cols-3">
      {dict.home.steps.map((step, index) => (
        <li key={step.title} className="bg-day-soft/70 p-8 sm:p-9">
          <span className="font-display text-3xl text-sun-deep/45">{`0${index + 1}`}</span>
          <h3 className="mt-5 font-display text-xl text-ink">{step.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

export default function Home() {
  const { t } = useI18n();
  const { entries, status, exhausted } = useEntries({ limit: SCAN });

  return (
    <>
      {/* The count is only shown when the first page held everything, so the
          number on the page is never an undercount dressed up as a total. */}
      <Hero count={status === "ready" && exhausted ? entries.length : null} />

      <Page>
        <Section className="pb-4 pt-28">
          <SectionHeading
            kicker={t("contribute.kicker")}
            title={t("home.howTitle")}
            lead={t("home.howLead")}
          />
          <Steps />
          <div className="mt-12 flex justify-center">
            <AddSticker size="lg" />
          </div>
        </Section>
      </Page>
    </>
  );
}
