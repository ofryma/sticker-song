import { Input, Textarea } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { PhotoField } from "./PhotoField.jsx";
import { LocationField } from "./LocationField.jsx";
import { FIELD } from "../ui/field.js";

/* A column, so a step that wants the room — the photograph — can take it and
   the step still ends where the screen does. */
function StepShell({ title, hint, children, blocker }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col animate-rise" key={title}>
      <h2 className="shrink-0 font-display text-2xl text-ink sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-lg shrink-0 text-sm leading-relaxed text-ink-muted sm:mt-3">
        {hint}
      </p>
      <div className="mt-5 flex min-h-0 flex-1 flex-col sm:mt-9">{children}</div>
      {blocker && <p className="mt-3 shrink-0 animate-fade text-sm text-sun-deep">{blocker}</p>}
    </div>
  );
}

/** The body of whichever step is current. Chrome lives in the page. */
export function DraftStep({ draft, step, preview, blocker, set, setImage }) {
  const { t } = useI18n();
  const message = blocker ? t(`contribute.required.${blocker}`) : null;

  if (step === "photo") {
    return (
      <StepShell
        title={t("contribute.photoTitle")}
        hint={t("contribute.photoHint")}
        blocker={message}
      >
        <PhotoField preview={preview} onPick={setImage} />
      </StepShell>
    );
  }

  if (step === "name") {
    return (
      <StepShell
        title={t("contribute.nameTitle")}
        hint={t("contribute.nameHint")}
        blocker={message}
      >
        <Input
          value={draft.personName}
          onValueChange={(personName) => set({ personName })}
          aria-label={t("contribute.nameTitle")}
          placeholder={t("contribute.namePlaceholder")}
          maxLength={255}
          autoComplete="off"
          autoFocus
          radius="sm"
          size="lg"
          variant="bordered"
          classNames={{ ...FIELD, input: `${FIELD.input} font-serif text-xl sm:text-2xl` }}
        />
      </StepShell>
    );
  }

  if (step === "text") {
    return (
      <StepShell
        title={t("contribute.textTitle")}
        hint={t("contribute.textHint")}
        blocker={message}
      >
        <Textarea
          value={draft.stickerText}
          onValueChange={(stickerText) => set({ stickerText })}
          aria-label={t("contribute.textTitle")}
          placeholder={t("contribute.textPlaceholder")}
          minRows={6}
          autoFocus
          radius="sm"
          variant="bordered"
          classNames={{ ...FIELD, input: `${FIELD.input} font-serif text-lg leading-loose` }}
        />
      </StepShell>
    );
  }

  return (
    <StepShell title={t("contribute.locationTitle")} hint={t("contribute.locationHint")}>
      <LocationField latitude={draft.latitude} longitude={draft.longitude} onChange={set} />
    </StepShell>
  );
}

/** A last quiet look at what is about to be kept. */
export function DraftReview({ draft, preview }) {
  const { t } = useI18n();
  return (
    <div className="mt-14 border-t border-day-line/70 pt-10">
      <p className="eyebrow mb-6">{t("contribute.review")}</p>
      <div className="flex flex-col gap-6 sm:flex-row">
        {preview && (
          <img
            src={preview}
            alt=""
            className="h-32 w-28 shrink-0 rounded-sm border border-day-line object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="font-display text-xl text-ink">{draft.personName}</p>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ink-muted">
            {draft.stickerText}
          </p>
        </div>
      </div>
    </div>
  );
}
