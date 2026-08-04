import { useI18n } from "../../i18n/index.jsx";

/**
 * Progress as a growing line: the steps already behind you stay green. It reads
 * as something accumulating rather than a bar filling up.
 */
export function StepRail({ stepIndex, total, onJump }) {
  const { t, dict } = useI18n();

  return (
    <div className="mb-14">
      <p className="eyebrow mb-5">{t("contribute.stepOf", { n: stepIndex + 1, total })}</p>

      <ol className="flex items-center gap-2 sm:gap-3">
        {dict.contribute.steps.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => index < stepIndex && onJump(index)}
              disabled={index >= stepIndex}
              className={[
                "shrink-0 text-xs transition-colors duration-1200 ease-calm",
                index < stepIndex ? "text-ink-muted hover:text-ink" : "",
                index === stepIndex ? "text-olive-deep" : "",
                index > stepIndex ? "text-ink-faint" : "",
              ].join(" ")}
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{index + 1}</span>
            </button>
            {index < total - 1 && (
              <span className="relative h-px flex-1 bg-day-line">
                <span
                  className={[
                    "absolute inset-0 origin-left bg-olive/50 rtl:origin-right",
                    "transition-transform duration-1800 ease-calm",
                    index < stepIndex ? "scale-x-100" : "scale-x-0",
                  ].join(" ")}
                />
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
