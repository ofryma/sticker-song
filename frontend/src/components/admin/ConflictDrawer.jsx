import { useState } from "react";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { useConflictDetail } from "../../hooks/useConflicts.js";
import { ErrorState, Loading } from "../States.jsx";
import { Action } from "../ui/Action.jsx";
import { ConflictCandidate } from "./ConflictCandidate.jsx";

/**
 * Every sticker held for one person, side by side. The reviewer keeps one and
 * the rest are destroyed — permanently, photographs included — so the choice is
 * made first and confirmed second.
 *
 * The suggestion is the largest image, votes breaking ties. It is only a
 * starting point: the decision is the reviewer's.
 */
export function ConflictDrawer({ name, token, onClose, onExpired, onResolved }) {
  return (
    <Drawer
      isOpen={Boolean(name)}
      onOpenChange={(open) => !open && onClose()}
      placement="right"
      size="2xl"
      radius="none"
      backdrop="transparent"
      shouldBlockScroll={false}
      classNames={{
        base: "bg-day border-s border-day-line shadow-lg",
        closeButton: "text-ink-muted top-4 end-4",
      }}
      motionProps={{
        variants: {
          enter: { opacity: 1, x: 0, transition: { duration: 0.18, ease: "easeOut" } },
          exit: { opacity: 0, x: 24, transition: { duration: 0.12, ease: "easeOut" } },
        },
      }}
    >
      <DrawerContent>
        {/* Keyed by the person: a different name starts with a fresh choice and
            no half-made confirmation. */}
        {name && (
          <Conflict
            key={name}
            name={name}
            token={token}
            onClose={onClose}
            onExpired={onExpired}
            onResolved={onResolved}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

/** One person's stickers, the choice between them, and the resolution. */
function Conflict({ name, token, onClose, onExpired, onResolved }) {
  const { t } = useI18n();
  const [chosenId, setChosenId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const conflict = useConflictDetail({ token, name, onExpired, onResolved });

  const detail = conflict.detail;
  const chosen = chosenId ?? detail?.suggested_best_id ?? null;
  const losers = (detail?.entries ?? []).filter((entry) => entry.id !== chosen);

  const resolve = async () => {
    const done = await conflict.resolve(chosen);
    if (done) onClose();
  };

  return (
    <>
      <DrawerHeader className="border-day-line/70 bg-day-soft/70 flex-col items-start gap-1 border-b">
        <p className="eyebrow">{t("admin.conflicts.kicker")}</p>
        <h2 className="text-ink font-serif text-2xl leading-tight break-words">
          {detail?.person_name ?? name}
        </h2>
      </DrawerHeader>

      <DrawerBody className="gap-4 py-6">
        {conflict.state === "loading" && <Loading label={t("admin.conflicts.loading")} />}
        {conflict.state === "error" && <ErrorState error={conflict.error} />}
        {conflict.state === "ready" && (
          <>
            <p className="text-ink-muted text-xs leading-relaxed">{t("admin.conflicts.lead")}</p>
            {detail.entries.map((entry) => (
              <ConflictCandidate
                key={entry.id}
                entry={entry}
                token={token}
                chosen={entry.id === chosen}
                suggested={entry.id === detail.suggested_best_id}
                onChoose={setChosenId}
              />
            ))}
          </>
        )}
      </DrawerBody>

      {conflict.state === "ready" && (
        <DrawerFooter className="border-day-line/70 bg-day-soft/60 border-t">
          {/* Two steps rather than a dialog: this one has no undo. */}
          <div className="flex w-full flex-wrap items-center gap-3">
            {confirming ? (
              <>
                <span className="text-sun-deep text-xs">{t("admin.conflicts.warning")}</span>
                <Action
                  tone="quiet"
                  size="sm"
                  isLoading={conflict.busy}
                  onPress={resolve}
                  className="text-sun-deep ms-auto"
                >
                  {t("admin.conflicts.confirm")}
                </Action>
                <Action tone="quiet" size="sm" onPress={() => setConfirming(false)}>
                  {t("admin.conflicts.cancel")}
                </Action>
              </>
            ) : (
              <Action
                tone="leaf"
                size="sm"
                isDisabled={losers.length === 0}
                onPress={() => setConfirming(true)}
              >
                {t("admin.conflicts.resolve", { n: losers.length })}
              </Action>
            )}
          </div>
        </DrawerFooter>
      )}
    </>
  );
}
