import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/index.jsx";
import { useContactMessage } from "../hooks/useContactMessage.js";
import { ContactForm, KINDS } from "../components/contact/ContactForm.jsx";
import { ContactThanks } from "../components/contact/ContactThanks.jsx";
import { Action } from "../components/ui/Action.jsx";
import { getEntry } from "../lib/api.js";

const COLUMN = "mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-24";

/**
 * Somewhere to write to us: a suggestion, something broken, or a problem with a
 * sticker. A visitor who came from an entry arrives with `?entry=<id>` and the
 * kind already chosen, so the only thing left to do is say what is wrong.
 */
export default function Contact() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const entryId = params.get("entry");
  const kindParam = params.get("kind");
  const form = useContactMessage({
    kind: KINDS.includes(kindParam) ? kindParam : "",
    entryId,
  });

  // The name of the sticker being written about, so a visitor can see they are
  // reporting the one they meant. "missing" rather than an error: not finding it
  // is a reason to say so quietly, never a reason to block the form.
  const [about, setAbout] = useState(entryId ? "loading" : null);
  useEffect(() => {
    if (!entryId) return;
    let live = true;
    getEntry(entryId)
      .then((entry) => live && setAbout(entry))
      .catch(() => live && setAbout("missing"));
    return () => {
      live = false;
    };
  }, [entryId]);

  if (form.state === "done") {
    return (
      <div className={COLUMN}>
        <ContactThanks />
      </div>
    );
  }

  const sending = form.state === "sending";

  return (
    <div className={COLUMN}>
      <header className="mb-12">
        <p className="eyebrow mb-4">{t("contact.kicker")}</p>
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{t("contact.title")}</h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-muted">{t("contact.lead")}</p>
      </header>

      {about && about !== "loading" && (
        <div className="mb-10 animate-fade rounded-sm border border-day-line bg-day-soft/70 px-5 py-4">
          <p className="eyebrow mb-2">{t("contact.aboutEntry")}</p>
          {about === "missing" ? (
            <p className="text-sm text-ink-muted">{t("contact.aboutEntryMissing")}</p>
          ) : (
            <p className="font-serif text-lg text-ink">{about.person_name}</p>
          )}
        </div>
      )}

      <form
        // The email field keeps type="email" for the keyboard it summons on a
        // phone, but the browser's own refusal is a bubble in its own words. Our
        // validation says the same thing in ours, so it takes over.
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          form.submit();
        }}
      >
        <ContactForm draft={form.draft} set={form.set} blocker={form.blocker} />

        {form.state === "error" && (
          <div className="mt-10 animate-fade rounded-sm border border-sun/50 bg-sun-pale/60 px-5 py-4">
            <p className="text-sun-deep text-sm">{t("contact.errorTitle")}</p>
            {form.error?.message && (
              <p className="mt-2 break-words text-xs leading-relaxed text-ink-muted">
                {form.error.message}
              </p>
            )}
          </div>
        )}

        <div className="mt-12 flex border-t border-day-line/70 pt-8">
          <Action type="submit" isLoading={sending} className="ms-auto max-sm:flex-1">
            {sending
              ? t("contact.sending")
              : form.state === "error"
                ? t("contact.errorRetry")
                : t("contact.send")}
          </Action>
        </div>
      </form>
    </div>
  );
}
