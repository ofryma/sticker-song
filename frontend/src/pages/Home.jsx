import { useState } from "react";
import { useI18n } from "../i18n/index.jsx";
import { useEntries } from "../hooks/useEntries.js";
import { Hero } from "../components/Hero.jsx";
import { Page, Section, SectionHeading } from "../components/Section.jsx";
import { WallGrid } from "../components/WallGrid.jsx";
import { EntryDetail } from "../components/EntryDetail.jsx";
import { Loading } from "../components/States.jsx";
import { Action } from "../components/ui/Action.jsx";

const PREVIEW = 8;
// One wide page, so the hero can state a real total instead of a page size.
const SCAN = 200;

function Steps() {
  const { dict } = useI18n();
  return (
    <ol className="grid gap-px overflow-hidden rounded-sm border border-night-line/70 bg-night-line/70 sm:grid-cols-3">
      {dict.home.steps.map((step, index) => (
        <li key={step.title} className="bg-night-soft/70 p-8 sm:p-9">
          <span className="font-display text-3xl text-flame/45">{`0${index + 1}`}</span>
          <h3 className="mt-5 font-display text-xl text-stone-50">{step.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-stone-400">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

export default function Home() {
  const { t } = useI18n();
  const { entries, status, exhausted } = useEntries({ limit: SCAN });
  const [selected, setSelected] = useState(null);

  return (
    <>
      {/* The count is only shown when the first page held everything, so the
          number on the page is never an undercount dressed up as a total. */}
      <Hero count={status === "ready" && exhausted ? entries.length : null} />

      <Page>
        <Section className="pb-28">
          <SectionHeading
            kicker={t("home.kicker")}
            title={t("home.latest")}
            lead={t("home.latestLead")}
            action={
              <Action tone="quiet" size="sm" to="/wall" className="shrink-0 text-flame/85 hover:text-flame-glow">
                {t("home.viewAll")}
              </Action>
            }
          />
          {status === "loading" ? (
            <Loading label={t("wall.loading")} />
          ) : entries.length > 0 ? (
            <WallGrid entries={entries.slice(0, PREVIEW)} onOpen={setSelected} />
          ) : null}
        </Section>

        <Section className="pb-4">
          <SectionHeading kicker={t("contribute.kicker")} title={t("home.howTitle")} lead={t("home.howLead")} />
          <Steps />
          <div className="mt-12 flex justify-center">
            <Action to="/contribute" size="lg">
              {t("nav.contribute")}
            </Action>
          </div>
        </Section>
      </Page>

      <EntryDetail entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}
