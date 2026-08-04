import { useState } from "react";
import { useI18n } from "../i18n/index.jsx";
import { useAdminSession } from "../hooks/useAdminSession.js";
import { useReviewQueue } from "../hooks/useReviewQueue.js";
import { Page } from "../components/Section.jsx";
import { ErrorState, Loading } from "../components/States.jsx";
import { SignInCard } from "../components/admin/SignInCard.jsx";
import { StatusTabs } from "../components/admin/StatusTabs.jsx";
import { ReviewCard } from "../components/admin/ReviewCard.jsx";
import { Action } from "../components/ui/Action.jsx";

/** The review queue. Not linked from anywhere; reachable only by knowing the path. */
export default function Admin() {
  const session = useAdminSession();
  const [status, setStatus] = useState("pending");

  if (session.status === "checking") return <Loading />;

  if (session.status !== "ready") {
    return (
      <Page className="max-w-xl pb-24">
        <SignInCard onSubmit={session.signIn} error={session.error} />
      </Page>
    );
  }

  return (
    <Page className="pb-28 sm:pb-16">
      <Queue
        token={session.token}
        status={status}
        onStatusChange={setStatus}
        onExpired={session.expire}
        onSignOut={session.signOut}
      />
    </Page>
  );
}

function Queue({ token, status, onStatusChange, onExpired, onSignOut }) {
  const { t } = useI18n();
  const queue = useReviewQueue({ token, status, onExpired });

  return (
    <>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">{t("admin.kicker")}</p>
          <h1 className="font-display text-ink text-3xl sm:text-4xl">{t("admin.title")}</h1>
          <p className="text-ink-muted mt-4 max-w-xl text-sm leading-relaxed">{t("admin.lead")}</p>
        </div>
        <Action tone="quiet" size="sm" onPress={onSignOut}>
          {t("admin.signOut")}
        </Action>
      </header>

      <StatusTabs value={status} onChange={onStatusChange} tally={queue.tally} />

      <div className="mt-10">
        {queue.state === "loading" && <Loading label={t("admin.loading")} />}
        {queue.state === "error" && <ErrorState error={queue.error} onRetry={queue.reload} />}
        {queue.state === "ready" &&
          (queue.entries.length === 0 ? (
            <p className="animate-fade text-ink-muted py-20 text-center text-sm">
              {t(`admin.empty.${status}`)}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {queue.entries.map((entry) => (
                <ReviewCard
                  key={entry.id}
                  entry={entry}
                  token={token}
                  busy={queue.busyId === entry.id}
                  onAct={queue.act}
                  onReanalyze={queue.reanalyze}
                />
              ))}
            </div>
          ))}
      </div>
    </>
  );
}
