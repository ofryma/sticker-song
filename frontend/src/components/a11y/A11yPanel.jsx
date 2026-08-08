import { Modal, ModalBody, ModalContent, Switch } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { A11Y_FLAGS, TEXT_STEPS } from "../../hooks/useA11y.js";
import { Action } from "../ui/Action.jsx";
import { Glyph } from "../ui/Glyph.jsx";

/* Each step of the text control shows its own size, so the choice is visible
   before it is made. */
const TEXT_SIZES = ["text-sm", "text-base", "text-lg"];

function Option({ label, hint, isSelected, onChange }) {
  return (
    <Switch
      color="success"
      size="sm"
      isSelected={isSelected}
      onValueChange={onChange}
      classNames={{
        base: "inline-flex w-full max-w-none flex-row-reverse items-center justify-between gap-4 rounded-sm px-1 py-2",
        label: "ms-0 me-0",
      }}
    >
      <span className="flex flex-col text-start">
        <span className="text-sm text-ink">{label}</span>
        <span className="text-xs leading-relaxed text-ink-muted">{hint}</span>
      </span>
    </Switch>
  );
}

/**
 * The display preferences, as a dialog. HeroUI's Modal traps focus, closes on
 * Escape and locks the page behind it; every change applies at once, so there
 * is nothing to confirm and nothing to save.
 */
export function A11yPanel({ isOpen, onClose, settings, toggle, setText, reset, changed }) {
  const { t } = useI18n();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      radius="sm"
      placement="center"
      scrollBehavior="inside"
      aria-label={t("a11y.title")}
      classNames={{
        backdrop: "bg-day/92",
        base: "bg-day-soft border border-day-line/80",
        closeButton: "text-ink-muted hover:bg-day-warm",
      }}
      motionProps={{
        variants: {
          enter: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 0.8, 0.24, 1] } },
          exit: { opacity: 0, y: 16, transition: { duration: 0.4, ease: "easeOut" } },
        },
      }}
    >
      <ModalContent>
        <ModalBody className="gap-6 px-5 py-7 sm:px-7">
          <header className="flex flex-col gap-1.5">
            <span className="eyebrow flex items-center gap-2">
              <Glyph name="access" className="h-3.5 w-3.5" />
              {t("a11y.kicker")}
            </span>
            <h2 className="font-display text-xl text-ink">{t("a11y.title")}</h2>
            <p className="text-sm leading-relaxed text-ink-muted">{t("a11y.lead")}</p>
          </header>

          <hr className="rule-fade" />

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm text-ink">{t("a11y.textSize")}</legend>
            <div className="flex items-center gap-2" role="group">
              {Array.from({ length: TEXT_STEPS }, (_, step) => (
                <Action
                  key={step}
                  tone={settings.text === step ? "leaf" : "ghost"}
                  onPress={() => setText(step)}
                  aria-pressed={settings.text === step}
                  aria-label={t(`a11y.textStep.${step}`)}
                  className={`min-w-14 ${TEXT_SIZES[step]}`}
                >
                  {t("a11y.textMark")}
                </Action>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col divide-y divide-day-line/60">
            {A11Y_FLAGS.map((flag) => (
              <Option
                key={flag}
                label={t(`a11y.${flag}`)}
                hint={t(`a11y.${flag}Hint`)}
                isSelected={settings[flag]}
                onChange={() => toggle(flag)}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-start">
            <Action onPress={onClose} className="w-full sm:w-auto">
              {t("a11y.done")}
            </Action>
            <Action tone="quiet" onPress={reset} isDisabled={!changed} className="w-full sm:w-auto">
              {t("a11y.reset")}
            </Action>
          </div>

          <p className="text-xs leading-relaxed text-ink-muted">{t("a11y.storedHint")}</p>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
