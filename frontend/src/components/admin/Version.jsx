import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { getHealth } from "../../lib/api.js";

/**
 * Which build is answering, in the corner of the review page. The number comes
 * from the backend rather than from anything bundled into this page, so it
 * describes what is actually running and not what was last built.
 *
 * It says nothing at all until it knows: an unreachable API is not news here —
 * every other panel on this page is about to say so far more clearly.
 */
export function Version() {
  const { t } = useI18n();
  const [version, setVersion] = useState(null);

  useEffect(() => {
    let alive = true;
    getHealth()
      .then((health) => alive && setVersion(health.version ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!version) return null;

  return (
    <p className="animate-fade font-sans text-xs text-ink-muted">
      {t("admin.version")} <span className="tabular-nums text-ink-soft">{version}</span>
    </p>
  );
}
