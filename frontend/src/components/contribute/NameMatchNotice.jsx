import { useI18n } from "../../i18n/index.jsx";
import { pluralCount } from "../../lib/format.js";

/**
 * A line under the name field while it is being filled in: the archive is being
 * looked through, and this is what it holds under this name. It only says so —
 * the choice of what to do about it belongs to the screen after this step, and
 * nothing here interrupts the typing.
 */
export function NameMatchNotice({ checking, matches }) {
  const { t } = useI18n();
  // The same name and a name merely close to it are different news, and only the
  // first one the step will stop over.
  const same = matches.filter((match) => match.is_exact_match);

  if (checking) {
    return (
      <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted" role="status">
        <span className="flex items-end gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full bg-olive/60 animate-breathe"
              style={{ animationDelay: `${i * 900}ms`, animationDuration: "3.6s" }}
            />
          ))}
        </span>
        {t("nameMatch.checking")}
      </p>
    );
  }

  if (matches.length === 0) return null;

  return (
    <p className="mt-4 animate-fade text-xs leading-relaxed text-olive-deep" role="status">
      {same.length > 0
        ? pluralCount(t, "nameMatch.found", same.length)
        : pluralCount(t, "nameMatch.similar", matches.length)}
    </p>
  );
}
