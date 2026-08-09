import { useState } from "react";
import { useI18n } from "../i18n/index.jsx";
import { useStickerDraft } from "../hooks/useStickerDraft.js";
import { useNameGate } from "../hooks/useNameGate.js";
import { StepRail } from "../components/contribute/StepRail.jsx";
import { DraftReview, DraftStep } from "../components/contribute/DraftSteps.jsx";
import { NameMatchNotice } from "../components/contribute/NameMatchNotice.jsx";
import { MatchKept, NameMatches } from "../components/contribute/NameMatches.jsx";
import { Thanks } from "../components/contribute/Thanks.jsx";
import { DuplicateReview } from "../components/contribute/DuplicateReview.jsx";
import { Action } from "../components/ui/Action.jsx";

/* Every screen of the flow is the same column. `wizard-viewport` holds it to
   exactly the room between the header and the bottom bar on a phone, so a step
   — and the thanks that follows it — is whole on the screen with nothing to
   scroll. */
const COLUMN = "mx-auto flex max-w-2xl flex-col px-4 pt-6 sm:px-8 sm:pt-28 sm:pb-8";
const ONE_SCREEN = `wizard-viewport ${COLUMN}`;

export default function Contribute() {
  const { t } = useI18n();
  const form = useStickerDraft();
  const gate = useNameGate(form);
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false);

  const startAgain = () => {
    setDismissedDuplicates(false);
    gate.restart();
  };

  if (form.state === "done") {
    // Only asked when the archive already holds this person and the new entry is
    // public — a draft has nothing to be compared against yet. Choosing between
    // photographs is a longer job than being thanked, so that one page flows and
    // scrolls in the ordinary way.
    const comparing = form.duplicates.length > 0 && !form.awaitingReview && !dismissedDuplicates;

    return (
      <div className={comparing ? `${COLUMN} pb-16` : ONE_SCREEN}>
        <Thanks entry={form.saved} awaitingReview={form.awaitingReview} onAnother={startAgain} />
        {comparing && (
          <DuplicateReview
            entry={form.saved}
            duplicates={form.duplicates}
            suggestedBestId={form.suggestedBestId}
            onSkip={() => setDismissedDuplicates(true)}
          />
        )}
      </div>
    );
  }

  // The upload was let go of in favour of the sticker already in the archive.
  if (gate.screen === "kept") {
    return (
      <div className={ONE_SCREEN}>
        <div className="flex min-h-0 flex-1 flex-col max-sm:overflow-y-auto">
          <MatchKept name={gate.name} onRestart={startAgain} />
        </div>
      </div>
    );
  }

  // The archive already holds this exact name. Comparing what is here against
  // what is in hand takes reading, so this page scrolls in the ordinary way.
  if (gate.screen === "deciding") {
    return (
      <div className={`${COLUMN} pb-16`}>
        <NameMatches
          name={gate.name}
          matches={gate.matches}
          onKeep={gate.keep}
          onOther={gate.proceed}
          onContinue={gate.proceed}
        />
        <Action tone="quiet" size="sm" onPress={gate.close} className="mt-10 self-start">
          {t("nameMatch.editName")}
        </Action>
      </div>
    );
  }

  const saving = form.state === "saving";

  return (
    /* Header, step, actions. Nothing scrolls — the step body in the middle
       absorbs whatever room is left over. */
    <div className={ONE_SCREEN}>
      {/* A visitor arrives here by pressing "Add a sticker", so on a phone the
          title only says what they already know — and the room is better spent
          on the step itself. It stays in the accessibility tree, so the page
          still has exactly one h1 at every width. */}
      <header className="max-sm:sr-only sm:mb-12">
        <p className="eyebrow mb-4">{t("contribute.kicker")}</p>
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{t("contribute.title")}</h1>
        <p className="mt-4 text-sm text-ink-muted">{t("contribute.lead")}</p>
      </header>

      <StepRail stepIndex={form.stepIndex} total={form.total} onJump={form.goTo} />

      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (form.isLast) form.submit();
          else gate.advance();
        }}
      >
        {/* Everything above the actions. The step inside takes the whole region,
            and the last step — which adds a look back over the draft — may be
            longer than a phone screen, so this scrolls rather than pushing the
            actions out of reach. */}
        <div className="flex min-h-0 flex-1 flex-col max-sm:overflow-y-auto">
          <DraftStep
            draft={form.draft}
            step={form.step}
            preview={form.preview}
            blocker={form.blocker}
            set={form.set}
            setImage={form.setImage}
            nameNotice={<NameMatchNotice {...gate.notice} />}
          />

          {form.isLast && <DraftReview draft={form.draft} preview={form.preview} />}

          {form.state === "error" && (
            <div className="mt-10 shrink-0 animate-fade rounded-sm border border-sun/50 bg-sun-pale/60 px-5 py-4">
              <p className="text-sun-deep text-sm">{t("contribute.errorTitle")}</p>
              {form.error?.message && (
                <p className="mt-2 break-words text-xs leading-relaxed text-ink-muted">
                  {form.error.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* The column is exactly as tall as the screen on a phone, so this row
            already sits at the bottom of it — no pinning, no scrim, and the
            primary step stays one thumb away. */}
        <div className="mt-4 flex shrink-0 items-center gap-3 border-t border-day-line/70 pt-3 sm:mt-14 sm:gap-4 sm:pt-8">
          {form.stepIndex > 0 && (
            <Action tone="quiet" size="sm" onPress={form.back} isDisabled={saving}>
              {t("contribute.back")}
            </Action>
          )}
          {/* The name step waits on the lookup before it advances, which is a
              moment on a slow connection — the button says so rather than
              looking as though the press was missed. */}
          <Action type="submit" isLoading={saving || gate.asking} className="ms-auto max-sm:flex-1">
            {form.isLast
              ? saving
                ? t("contribute.submitting")
                : form.state === "error"
                  ? t("contribute.errorRetry")
                  : t("contribute.submit")
              : t("contribute.next")}
          </Action>
        </div>
      </form>
    </div>
  );
}
