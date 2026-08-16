import { useState } from "react";
import { Tab, Tabs } from "@heroui/react";
import { useI18n } from "../i18n/index.jsx";
import { useAdminSession } from "../hooks/useAdminSession.js";
import { Page } from "../components/Section.jsx";
import { Loading } from "../components/States.jsx";
import { SignInCard } from "../components/admin/SignInCard.jsx";
import { QueueView } from "../components/admin/QueueView.jsx";
import { ConflictsView } from "../components/admin/ConflictsView.jsx";
import { MessagesView } from "../components/admin/MessagesView.jsx";
import { BackupsView } from "../components/admin/BackupsView.jsx";
import { Version } from "../components/admin/Version.jsx";
import { Action } from "../components/ui/Action.jsx";

/** The review pages. Not linked from anywhere; reachable only by knowing the path. */
export default function Admin() {
  const session = useAdminSession();

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
      <Review token={session.token} onExpired={session.expire} onSignOut={session.signOut} />
    </Page>
  );
}

/**
 * Three jobs, kept apart: reading the submissions that have come in, settling
 * the people the archive holds twice, and answering what visitors wrote.
 */
function Review({ token, onExpired, onSignOut }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("queue");
  const [status, setStatus] = useState("pending");

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">{t("admin.kicker")}</p>
          <h1 className="font-display text-ink text-3xl sm:text-4xl">{t("admin.title")}</h1>
        </div>
        {/* Which build is running, beside the way out — the two things you want
            when something looks wrong and you are about to report it. */}
        <div className="flex items-center gap-4">
          <Version />
          <Action tone="quiet" size="sm" onPress={onSignOut}>
            {t("admin.signOut")}
          </Action>
        </div>
      </header>

      <Tabs
        aria-label={t("admin.mode.label")}
        selectedKey={mode}
        onSelectionChange={(key) => setMode(String(key))}
        variant="underlined"
        classNames={{
          base: "mb-6",
          tabList: "gap-6 p-0",
          cursor: "bg-olive/70",
          tab: "h-10 px-0 data-[hover-unselected=true]:opacity-100",
          tabContent: "text-ink-muted group-data-[selected=true]:text-ink text-sm",
        }}
      >
        <Tab key="queue" title={t("admin.mode.queue")} />
        <Tab key="conflicts" title={t("admin.mode.conflicts")} />
        <Tab key="messages" title={t("admin.mode.messages")} />
        <Tab key="backups" title={t("admin.mode.backups")} />
      </Tabs>

      {/* A lookup rather than nested ternaries, now that there are several. */}
      {
        {
          queue: (
            <QueueView
              token={token}
              status={status}
              onStatusChange={setStatus}
              onExpired={onExpired}
            />
          ),
          conflicts: <ConflictsView token={token} onExpired={onExpired} />,
          messages: <MessagesView token={token} onExpired={onExpired} />,
          backups: <BackupsView token={token} onExpired={onExpired} />,
        }[mode]
      }
    </>
  );
}
