import { useEffect, useState } from "react";
import { Modal, ModalBody, ModalContent } from "@heroui/react";
import { useI18n } from "../../i18n/index.jsx";
import { useCropBox } from "../../hooks/useCropBox.js";
import { frameOf, loadImage, renderEdit } from "../../lib/image.js";
import { Action } from "../ui/Action.jsx";
import { Glyph } from "../ui/Glyph.jsx";
import { Loading } from "../States.jsx";
import { CropFrame } from "./CropFrame.jsx";

/** One turn or fold of the photograph, drawn rather than named. */
function Tool({ icon, label, onPress, isDisabled }) {
  return (
    <Action
      tone="ghost"
      isIconOnly
      onPress={onPress}
      isDisabled={isDisabled}
      aria-label={label}
      title={label}
    >
      <Glyph name={icon} className="h-[1.15rem] w-[1.15rem]" />
    </Action>
  );
}

/**
 * The photograph, straightened and framed. Mounted only while the sheet is
 * open, so every edit starts from the picture as it was handed over.
 */
function Editor({ src, name, onApply, onClose }) {
  const { t } = useI18n();
  const box = useCropBox();
  const [source, setSource] = useState(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    loadImage(src).then(
      (image) => live && setSource({ width: image.naturalWidth, height: image.naturalHeight }),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [src]);

  const keep = async () => {
    setSaving(true);
    setFailed(false);
    const file = await renderEdit(
      src,
      { rotation: box.rotation, flipped: box.flipped, crop: box.crop },
      name,
    ).catch(() => null);
    setSaving(false);
    if (file) onApply(file);
    else setFailed(true);
  };

  const frame = source && frameOf(source.width, source.height, box.rotation);

  return (
    <ModalBody>
      <div className="flex flex-col gap-5 p-4 sm:gap-6 sm:p-6">
        <div>
          <h2 className="font-display text-xl text-ink sm:text-2xl">{t("contribute.cropTitle")}</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-muted">
            {t("contribute.cropHint")}
          </p>
        </div>

        {frame ? (
          <CropFrame
            src={src}
            frame={frame}
            rotation={box.rotation}
            flipped={box.flipped}
            crop={box.crop}
            box={box}
          />
        ) : (
          <div className="flex h-[46svh] items-center justify-center rounded-sm border border-day-line bg-day-soft sm:h-[54vh]">
            {failed ? (
              <p className="animate-fade text-sm text-sun-deep">{t("contribute.cropFailed")}</p>
            ) : (
              <Loading label={t("common.loading")} />
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Tool
            icon="rotateLeft"
            label={t("contribute.rotateLeft")}
            onPress={() => box.rotate(-1)}
            isDisabled={!frame}
          />
          <Tool
            icon="rotateRight"
            label={t("contribute.rotateRight")}
            onPress={() => box.rotate(1)}
            isDisabled={!frame}
          />
          <Tool icon="flip" label={t("contribute.flip")} onPress={box.flip} isDisabled={!frame} />
          <Action tone="quiet" size="sm" onPress={box.reset} isDisabled={!box.touched}>
            {t("contribute.cropReset")}
          </Action>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-day-line/70 pt-5">
          <Action tone="quiet" onPress={onClose}>
            {t("contribute.cropCancel")}
          </Action>
          <Action
            tone="primary"
            className="ms-auto"
            onPress={keep}
            isDisabled={!frame}
            isLoading={saving}
          >
            {t("contribute.cropApply")}
          </Action>
        </div>

        {failed && frame && (
          <p className="animate-fade text-sm text-sun-deep">{t("contribute.cropFailed")}</p>
        )}
      </div>
    </ModalBody>
  );
}

/** The editor, as a sheet over the photo step — the same light chrome as the camera. */
export function PhotoEditor({ isOpen, src, name, onApply, onClose }) {
  const { t } = useI18n();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      radius="sm"
      backdrop="blur"
      placement="center"
      aria-label={t("contribute.cropTitle")}
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
        {isOpen && src && <Editor src={src} name={name} onApply={onApply} onClose={onClose} />}
      </ModalContent>
    </Modal>
  );
}
