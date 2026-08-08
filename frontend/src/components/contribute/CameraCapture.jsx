import { useEffect, useState } from "react";
import { Modal, ModalBody, ModalContent } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { useCamera } from "../../hooks/useCamera.js";
import { Action } from "../ui/Action.jsx";
import { Loading } from "../States.jsx";

const MESSAGES = {
  denied: "contribute.cameraDenied",
  unavailable: "contribute.cameraUnavailable",
  error: "contribute.cameraError",
};

/**
 * The viewfinder itself, mounted only while the sheet is open so the camera is
 * released the moment it closes.
 */
function Viewfinder({ onCapture, onClose }) {
  const { t } = useI18n();
  const { videoRef, status, mirrored, start, capture } = useCamera();
  const [taking, setTaking] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    start();
  }, [start]);

  const take = async () => {
    setTaking(true);
    setFailed(false);
    const file = await capture();
    setTaking(false);
    if (file) onCapture(file);
    else setFailed(true);
  };

  const message = failed ? t("contribute.cameraError") : MESSAGES[status] && t(MESSAGES[status]);

  return (
    <ModalBody>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <h2 className="sr-only">{t("contribute.cameraTitle")}</h2>

        <div className="relative overflow-hidden rounded-sm border border-day-line bg-day">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label={t("contribute.cameraTitle")}
            className={[
              "h-[52svh] w-full animate-fade object-contain sm:h-[60vh]",
              mirrored ? "-scale-x-100" : "",
            ].join(" ")}
          />
          {status !== "live" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-day-soft px-8 text-center">
              {status === "starting" || status === "idle" ? (
                <Loading label={t("contribute.cameraStarting")} />
              ) : (
                <p className="max-w-sm animate-fade text-sm leading-relaxed text-ink-muted">
                  {message}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Action tone="quiet" onPress={onClose}>
            {t("contribute.cameraCancel")}
          </Action>
          <Action
            tone="primary"
            className="ms-auto"
            onPress={take}
            isDisabled={status !== "live"}
            isLoading={taking}
          >
            {t("contribute.cameraShutter")}
          </Action>
        </div>

        {failed && status === "live" && (
          <p className="animate-fade text-sm text-sun-deep">{t("contribute.cameraError")}</p>
        )}
      </div>
    </ModalBody>
  );
}

/** The camera, as a sheet over the photo step. Light chrome, as everywhere. */
export function CameraCapture({ isOpen, onCapture, onClose }) {
  const { t } = useI18n();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      radius="sm"
      backdrop="blur"
      placement="center"
      aria-label={t("contribute.cameraTitle")}
      classNames={{
        backdrop: "bg-day/92",
        base: "bg-day-soft border border-day-line/80 m-0 h-full max-h-full rounded-none sm:h-auto sm:max-h-[92vh] sm:m-1 sm:rounded-sm",
        wrapper: "sm:p-6",
        body: "p-0",
        closeButton: "hidden",
      }}
      motionProps={{
        variants: {
          enter: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 0.8, 0.24, 1] } },
          exit: { opacity: 0, y: 24, transition: { duration: 0.5, ease: "easeOut" } },
        },
      }}
    >
      <ModalContent>
        {isOpen && <Viewfinder onCapture={onCapture} onClose={onClose} />}
      </ModalContent>
    </Modal>
  );
}
