import { Input, Textarea } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { FIELD } from "../ui/field.js";
import { mapUrl } from "../../lib/format.js";

/* The name and the transcription are the entry, so they are set in the families
   they are shown in on the wall; the note is interface chrome. */
const NAME_FIELD = { ...FIELD, input: "font-serif text-lg" };
const TEXT_FIELD = { ...FIELD, input: "font-serif text-base leading-loose" };

/** The label above a field, matching the contact form: a heading, not a floating
    label competing with the words somebody is correcting. */
function Label({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="eyebrow mb-2 block">
      {children}
    </label>
  );
}

function Problem({ of }) {
  const { t } = useI18n();
  if (!of) return null;
  return <p className="text-sun-deep mt-1.5 animate-fade text-xs">{t(`admin.edit.bad.${of}`)}</p>;
}

/**
 * Everything an entry says, as fields rather than as text. A misread name or a
 * mistyped word is the commonest thing wrong with a submission, and correcting
 * it is kinder to the person remembered than holding the whole entry back.
 *
 * Nothing saves on its own — `draft` only collects what changed, and `EditBar`
 * offers to keep it.
 */
export function EntryFields({ draft }) {
  const { t } = useI18n();
  const { form, set, problems } = draft;
  const coords = !problems.latitude && !problems.longitude && form.latitude && form.longitude;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Label htmlFor="edit-name">{t("admin.edit.name")}</Label>
        <Input
          id="edit-name"
          value={form.person_name}
          onValueChange={(value) => set("person_name", value)}
          radius="sm"
          variant="bordered"
          isInvalid={Boolean(problems.person_name)}
          classNames={NAME_FIELD}
        />
        <Problem of={problems.person_name} />
      </div>

      <div>
        <Label htmlFor="edit-text">{t("admin.edit.text")}</Label>
        <Textarea
          id="edit-text"
          value={form.sticker_text}
          onValueChange={(value) => set("sticker_text", value)}
          minRows={3}
          maxRows={14}
          radius="sm"
          variant="bordered"
          isInvalid={Boolean(problems.sticker_text)}
          classNames={TEXT_FIELD}
        />
        <Problem of={problems.sticker_text} />
      </div>

      <div>
        <Label htmlFor="edit-latitude">{t("admin.edit.location")}</Label>
        <div className="flex flex-wrap items-start gap-3">
          <Input
            id="edit-latitude"
            value={form.latitude}
            onValueChange={(value) => set("latitude", value)}
            aria-label={t("admin.edit.latitude")}
            placeholder={t("admin.edit.latitude")}
            inputMode="decimal"
            radius="sm"
            variant="bordered"
            isInvalid={Boolean(problems.latitude)}
            classNames={{ ...FIELD, base: "w-40", input: "text-sm" }}
          />
          <Input
            id="edit-longitude"
            value={form.longitude}
            onValueChange={(value) => set("longitude", value)}
            aria-label={t("admin.edit.longitude")}
            placeholder={t("admin.edit.longitude")}
            inputMode="decimal"
            radius="sm"
            variant="bordered"
            isInvalid={Boolean(problems.longitude)}
            classNames={{ ...FIELD, base: "w-40", input: "text-sm" }}
          />
          {coords && (
            <a
              href={mapUrl(Number(form.latitude), Number(form.longitude))}
              target="_blank"
              rel="noreferrer"
              className="text-ink-muted hover:text-ink self-center text-xs transition-colors duration-700"
            >
              {t("admin.edit.onMap")}
            </a>
          )}
        </div>
        <Problem of={problems.latitude || problems.longitude} />
        <p className="text-ink-muted mt-1.5 text-xs leading-relaxed">
          {t("admin.edit.locationHint")}
        </p>
      </div>

      <div>
        <Label htmlFor="edit-note">{t("admin.edit.note")}</Label>
        <Textarea
          id="edit-note"
          value={form.review_note}
          onValueChange={(value) => set("review_note", value)}
          placeholder={t("admin.notePlaceholder")}
          minRows={1}
          maxRows={5}
          radius="sm"
          variant="bordered"
          classNames={{ ...FIELD, input: "text-sm" }}
        />
      </div>
    </div>
  );
}
