import { useState } from "react";
import { useI18n } from "../i18n/index.jsx";
import { useStickerDraft } from "../hooks/useStickerDraft.js";
import { Page } from "../components/Section.jsx";
import { StepRail } from "../components/contribute/StepRail.jsx";
import { DraftReview, DraftStep } from "../components/contribute/DraftSteps.jsx";
import { Thanks } from "../components/contribute/Thanks.jsx";
import { DuplicateReview } from "../components/contribute/DuplicateReview.jsx";
import { EntryDetail } from "../components/EntryDetail.jsx";
import { Action } from "../components/ui/Action.jsx";

export default function Contribute() {
  const { t } = useI18n();
  const form = useStickerDraft();
  const [showSaved, setShowSaved] = useState(false);
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false);

  if (form.state === "done") {
    return (
      <Page className="max-w-2xl pb-16">
        <Thanks
          entry={form.saved}
          onView={() => setShowSaved(true)}
          onAnother={() => {
            setShowSaved(false);
            setDismissedDuplicates(false);
            form.reset();
          }}
        />
        {/* Only asked when the archive may already hold this person. */}
        {form.duplicates.length > 0 && !dismissedDuplicates && (
          <DuplicateReview
            entry={form.saved}
            duplicates={form.duplicates}
            suggestedBestId={form.suggestedBestId}
            onSkip={() => setDismissedDuplicates(true)}
          />
        )}
        {showSaved && <EntryDetail entry={form.saved} onClose={() => setShowSaved(false)} />}
      </Page>
    );
  }

  const saving = form.state === "saving";

  return (
    /* pb leaves room for the pinned mobile action bar. */
    <Page className="max-w-2xl pb-28 sm:pb-8">
      <header className="mb-12">
        <p className="eyebrow mb-4">{t("contribute.kicker")}</p>
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{t("contribute.title")}</h1>
        <p className="mt-4 text-sm text-ink-muted">{t("contribute.lead")}</p>
      </header>

      <StepRail stepIndex={form.stepIndex} total={form.total} onJump={form.goTo} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (form.isLast) form.submit();
          else form.next();
        }}
      >
        <DraftStep
          draft={form.draft}
          step={form.step}
          preview={form.preview}
          blocker={form.blocker}
          set={form.set}
          setImage={form.setImage}
        />

        {form.isLast && <DraftReview draft={form.draft} preview={form.preview} />}

        {form.state === "error" && (
          <div className="mt-10 animate-fade rounded-sm border border-sun/50 bg-sun-pale/60 px-5 py-4">
            <p className="text-sun-deep text-sm">{t("contribute.errorTitle")}</p>
            {form.error?.message && (
              <p className="mt-2 break-words text-xs leading-relaxed text-ink-muted">
                {form.error.message}
              </p>
            )}
          </div>
        )}

        {/* Mobile: the actions stay pinned above the bottom bar so the primary
            step is always one thumb away. Desktop: an ordinary footer row. */}
        <div
          className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t border-day-line/70 bg-day/95 px-4 py-3 backdrop-blur-md
            sm:static sm:mt-14 sm:gap-4 sm:border-day-line/70 sm:bg-transparent sm:px-0 sm:pt-8 sm:backdrop-blur-none"
        >
          {form.stepIndex > 0 && (
            <Action tone="quiet" size="sm" onPress={form.back} isDisabled={saving}>
              {t("contribute.back")}
            </Action>
          )}
          <Action type="submit" isLoading={saving} className="ms-auto max-sm:flex-1">
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
    </Page>
  );
}
