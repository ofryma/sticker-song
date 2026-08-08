/**
 * `classNames` for a bordered HeroUI input, in one place so every form in the
 * archive — the submission wizard, the contact page — reads as the same form.
 * Spread it and override only `input` where a field wants a different family.
 */
export const FIELD = {
  input: "text-base placeholder:text-ink-muted",
  inputWrapper:
    "border-day-line bg-day-soft/70 transition-colors duration-700 ease-calm " +
    "hover:border-tekhelet-light/50 group-data-[focus=true]:border-tekhelet-light",
};
