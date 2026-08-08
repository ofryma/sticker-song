import { Input, Radio, RadioGroup, Textarea } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { FIELD } from "../ui/field.js";

export const KINDS = ["suggestion", "bug", "entry_problem"];

/* The label above a field. HeroUI's own floating label sits inside the border
   and competes with the text somebody is writing; a plain heading does not. */
function Label({ htmlFor, children, hint }) {
  return (
    <div className="mb-2">
      <label htmlFor={htmlFor} className="eyebrow block">
        {children}
      </label>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{hint}</p>}
    </div>
  );
}

/** What a visitor writes to us. Chrome and submission live in the page. */
export function ContactForm({ draft, set, blocker }) {
  const { t } = useI18n();
  const message = blocker ? t(`contact.required.${blocker}`) : null;

  return (
    <div className="flex flex-col gap-9">
      <div>
        <RadioGroup
          value={draft.kind}
          onValueChange={(kind) => set({ kind })}
          label={<span className="eyebrow">{t("contact.kindLabel")}</span>}
          classNames={{ label: "mb-1", wrapper: "gap-3" }}
        >
          {KINDS.map((kind) => (
            <Radio
              key={kind}
              value={kind}
              description={t(`contact.kindHint.${kind}`)}
              classNames={{
                base: "max-w-full items-start",
                label: "text-sm text-ink",
                description: "text-xs leading-relaxed text-ink-muted",
                wrapper: "border-day-line group-data-[selected=true]:border-tekhelet",
              }}
            >
              {t(`contact.kind.${kind}`)}
            </Radio>
          ))}
        </RadioGroup>
      </div>

      <div>
        <Label htmlFor="contact-body" hint={t("contact.bodyHint")}>
          {t("contact.bodyLabel")}
        </Label>
        <Textarea
          id="contact-body"
          value={draft.body}
          onValueChange={(body) => set({ body })}
          placeholder={t("contact.bodyPlaceholder")}
          maxLength={4000}
          minRows={6}
          radius="sm"
          variant="bordered"
          classNames={{ ...FIELD, input: `${FIELD.input} leading-relaxed` }}
        />
      </div>

      <div>
        <Label htmlFor="contact-email" hint={t("contact.emailHint")}>
          {t("contact.emailLabel")}
        </Label>
        <Input
          id="contact-email"
          type="email"
          value={draft.replyEmail}
          onValueChange={(replyEmail) => set({ replyEmail })}
          placeholder={t("contact.emailPlaceholder")}
          maxLength={254}
          autoComplete="email"
          radius="sm"
          variant="bordered"
          classNames={FIELD}
        />
      </div>

      {/* The honeypot. No label, no tab stop, nothing to read out — a person
          never meets it, so anything in it came from a script. */}
      <input
        type="text"
        name="website"
        className="honeypot"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={draft.website ?? ""}
        onChange={(event) => set({ website: event.target.value })}
      />

      {message && <p className="animate-fade text-sm text-sun-deep">{message}</p>}
    </div>
  );
}
