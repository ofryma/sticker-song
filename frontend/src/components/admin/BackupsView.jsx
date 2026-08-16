import { useI18n } from "../../i18n/index.jsx";
import { useBackups } from "../../hooks/useBackups.js";
import { formatAgo, formatBytes, formatShortDate } from "../../lib/format.js";
import { ErrorState, Loading } from "../States.jsx";
import { Action } from "../ui/Action.jsx";

/**
 * The backups tab: when the archive was last copied to the drive beside it, and
 * what those copies hold.
 *
 * Nothing here is a button that does something — a backup is started by a timer
 * on the server and a restore is a command run on the box, deliberately. This
 * answers one question, which is the one worth being able to answer without an
 * ssh session: is the archive safe tonight.
 */
export function BackupsView({ token, onExpired }) {
  const { t, locale } = useI18n();
  const backups = useBackups({ token, onExpired });

  if (backups.state === "loading") return <Loading label={t("admin.backups.loading")} />;
  if (backups.state === "error")
    return <ErrorState error={backups.error} onRetry={backups.reload} />;

  const {
    configured,
    last_success: last,
    stale,
    snapshots,
    stale_after_hours: after,
  } = backups.status;

  if (!configured) {
    return (
      <p className="animate-fade text-ink-muted py-20 text-center text-sm">
        {t("admin.backups.noDrive")}
      </p>
    );
  }

  return (
    <div className="animate-fade">
      <div className="border-day-line/70 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <p className="eyebrow mb-2">{t("admin.backups.kicker")}</p>
          <p className={`font-display text-2xl ${stale ? "text-sun-deep" : "text-ink"}`}>
            {last
              ? t("admin.backups.lastAt", { when: formatAgo(last, locale) })
              : t("admin.backups.never")}
          </p>
          <p className="text-ink-muted mt-2 max-w-xl text-sm leading-relaxed">
            {stale ? t("admin.backups.stale", { hours: after }) : t("admin.backups.lead")}
          </p>
        </div>
        <Action tone="quiet" size="sm" onPress={backups.reload}>
          {t("admin.backups.refresh")}
        </Action>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-ink-muted py-20 text-center text-sm">{t("admin.backups.empty")}</p>
      ) : (
        <SnapshotTable snapshots={snapshots} />
      )}
    </div>
  );
}

/** The kept generations, newest first. Small enough that it is a list, not a grid. */
function SnapshotTable({ snapshots }) {
  const { t, locale } = useI18n();
  const columns = ["when", "entries", "photos", "size", "build"];

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-day-line/70 border-b">
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="text-ink-muted tracking-label px-3 py-2 text-start text-xs font-normal uppercase"
              >
                {t(`admin.backups.col.${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshots.map((snapshot, index) => (
            <tr key={snapshot.id} className="border-day-line/40 border-b last:border-0">
              <td className="text-ink px-3 py-3">
                {snapshot.finished_at ? formatShortDate(snapshot.finished_at, locale) : snapshot.id}
                {index === 0 && (
                  <span className="text-olive-deep ms-2 text-xs">{t("admin.backups.newest")}</span>
                )}
              </td>
              <td className="text-ink-soft px-3 py-3 tabular-nums">{snapshot.entries ?? "—"}</td>
              <td className="text-ink-soft px-3 py-3 tabular-nums">
                {snapshot.object_count ?? "—"}
              </td>
              <td className="text-ink-soft px-3 py-3 tabular-nums">
                {formatBytes(snapshot.object_bytes)}
              </td>
              <td className="text-ink-muted px-3 py-3 text-xs">{snapshot.image_tag ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
