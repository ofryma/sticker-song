import { useI18n } from "../i18n/index.jsx";
import { Sprig } from "./Sprig.jsx";
import { Action } from "./ui/Action.jsx";

/** Waiting state: three slow-breathing marks, nothing that spins. */
export function Loading({ label }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-5 py-24" role="status">
      <div className="flex items-end gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-olive/60 animate-breathe"
            style={{ animationDelay: `${i * 900}ms`, animationDuration: "3.6s" }}
          />
        ))}
      </div>
      <p className="text-xs tracking-label uppercase text-ink-muted">
        {label ?? t("common.loading")}
      </p>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="card-stone mx-auto max-w-md px-8 py-10 text-center animate-fade">
      <p className="text-ink">{t("common.error")}</p>
      {error?.message && (
        <p className="mt-3 break-words text-xs leading-relaxed text-ink-muted">{error.message}</p>
      )}
      {onRetry && (
        <Action tone="ghost" onPress={onRetry} className="mt-7">
          {t("common.retry")}
        </Action>
      )}
    </div>
  );
}

export function EmptyWall() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-6 py-24 text-center animate-fade-slow">
      <Sprig size={32} className="animate-unfurl" />
      <p className="font-display text-xl text-ink">{t("wall.empty")}</p>
      <p className="text-sm text-ink-muted">{t("wall.emptyLead")}</p>
      <Action tone="ghost" to="/contribute" className="mt-2">
        {t("nav.contribute")}
      </Action>
    </div>
  );
}

export function NoResults({ onClear }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-5 py-20 text-center animate-fade">
      <p className="text-ink-soft">{t("wall.noResults")}</p>
      <Action tone="quiet" size="sm" onPress={onClear}>
        {t("wall.clear")}
      </Action>
    </div>
  );
}
