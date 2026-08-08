import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { formatDate } from "../../lib/format.js";
import { Action } from "../ui/Action.jsx";

/**
 * One message in full, opened from a row. Short by nature — some prose, the
 * sticker it names, and two ways to close it.
 */
export function MessageDrawer({ message, busy, onClose, onDecide }) {
  const { t, locale } = useI18n();

  return (
    <Drawer
      isOpen={Boolean(message)}
      onOpenChange={(open) => !open && onClose()}
      placement="right"
      size="lg"
      radius="none"
      // The same working panel as the review drawer: the list stays beside it,
      // and the motion is short. The unhurried timings are for visitors.
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
        {message && (
          <>
            <DrawerHeader className="border-day-line/70 bg-day-soft/70 flex-col items-start gap-1 border-b">
              <p className="eyebrow">{t(`admin.messages.kind.${message.kind}`)}</p>
              <time dateTime={message.created_at} className="text-ink-soft text-sm">
                {formatDate(message.created_at, locale)}
              </time>
            </DrawerHeader>

            <DrawerBody className="gap-6 py-6">
              <p className="text-ink font-serif text-base leading-loose whitespace-pre-line break-words">
                {message.body}
              </p>

              {message.kind === "entry_problem" && (
                <div className="border-day-line bg-day-soft/70 rounded-sm border px-4 py-3">
                  <p className="eyebrow mb-2">{t("admin.messages.about")}</p>
                  {message.entry_person_name ? (
                    <p className="text-ink font-serif text-lg break-words">
                      {message.entry_person_name}
                    </p>
                  ) : (
                    <p className="text-ink-muted text-sm">{t("admin.messages.aboutGone")}</p>
                  )}
                </div>
              )}

              {/* Whether a reply is possible, not the address itself — that never
                  leaves the database, and answering is done by hand. */}
              <p className="text-ink-muted text-xs">
                {message.has_reply_email
                  ? t("admin.messages.canReply")
                  : t("admin.messages.noReply")}
              </p>

              {message.status !== "open" && message.resolved_by && (
                <p className="text-ink-muted text-xs">
                  {t("admin.messages.decidedBy", { who: message.resolved_by })}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter className="border-day-line/70 bg-day-soft/60 justify-start gap-3 border-t">
              <Action
                onPress={() => onDecide(message.id, "resolve")}
                isDisabled={busy || message.status === "resolved"}
                size="sm"
              >
                {t("admin.messages.resolve")}
              </Action>
              <Action
                tone="ghost"
                onPress={() => onDecide(message.id, "dismiss")}
                isDisabled={busy || message.status === "dismissed"}
                size="sm"
              >
                {t("admin.messages.dismiss")}
              </Action>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
