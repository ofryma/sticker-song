import { useRef, useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { rejectReason } from "../../hooks/useStickerDraft.js";
import { cameraSupported } from "../../hooks/useCamera.js";
import { useWide } from "../../hooks/useWide.js";
import { Action } from "../ui/Action.jsx";
import { Glyph } from "../ui/Glyph.jsx";
import { CameraCapture } from "./CameraCapture.jsx";
import { PhotoEditor } from "./PhotoEditor.jsx";

/** A blank sticker, waiting on the wall. */
function BlankSticker() {
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11 text-ink-muted" fill="none" aria-hidden="true">
      <path d="M8 8h24l8 8v24H8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M32 8v8h8" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="19" cy="24" r="3.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M12 34l7-6 6 5 5-4 6 5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One of the actions under a chosen photograph. The word is not printed, so it
 * has to reach a screen reader by label and a cursor by tooltip.
 */
function PhotoAction({ icon, label, onPress }) {
  return (
    <Action tone="quiet" isIconOnly size="sm" onPress={onPress} aria-label={label} title={label}>
      <Glyph name={icon} className="h-[1.15rem] w-[1.15rem]" />
    </Action>
  );
}

/** Photo picker: the camera in the page, a file from the device, or a drop. */
export function PhotoField({ preview, onPick }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState(null);
  const [camera, setCamera] = useState(false);
  const [editing, setEditing] = useState(false);
  // Only so a cropped photograph keeps the name of the one it came from.
  const [name, setName] = useState(null);
  const hasCamera = cameraSupported();
  const wide = useWide();
  // On a phone the sticker is on the wall in front of you, so the camera is the
  // way in and the file picker is the fallback. At a desk it is the other way
  // round: the photograph was taken hours ago and is sitting in a folder.
  const cameraFirst = hasCamera && !wide;

  const openCamera = () => setCamera(true);
  const openPicker = () => inputRef.current?.click();

  const accept = (candidate) => {
    if (!candidate) return;
    const reason = rejectReason(candidate);
    setRejected(reason);
    if (reason) return;
    setName(candidate.name);
    onPick(candidate);
  };

  const captured = (photo) => {
    setCamera(false);
    accept(photo);
  };

  const edited = (photo) => {
    setEditing(false);
    accept(photo);
  };

  return (
    /* The photograph takes whatever height the step has left, so the step fits
       the screen instead of running off the bottom of it. */
    <div className="flex min-h-0 flex-1 flex-col">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => accept(event.target.files?.[0])}
      />

      {preview ? (
        <figure className="flex min-h-0 flex-1 flex-col animate-fade">
          <div className="flex min-h-0 flex-1 items-center overflow-hidden rounded-sm border border-day-line bg-day">
            <img
              src={preview}
              alt=""
              className="max-h-full w-full animate-fade object-contain sm:max-h-[52vh]"
            />
          </div>
          {/* The photograph is its own confirmation — a filename and a byte
              count say nothing a visitor came here to read, and a captured
              frame's name is only a timestamp. */}
          <figcaption className="mt-2 flex shrink-0 items-center gap-x-1">
            <PhotoAction
              icon="crop"
              label={t("contribute.crop")}
              onPress={() => setEditing(true)}
            />
            {hasCamera && (
              <PhotoAction icon="camera" label={t("contribute.retake")} onPress={openCamera} />
            )}
            <PhotoAction icon="swap" label={t("contribute.replace")} onPress={openPicker} />
            <PhotoAction icon="cross" label={t("contribute.remove")} onPress={() => onPick(null)} />
          </figcaption>
        </figure>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-5">
          {/* The way in. On a phone it opens the camera; at a desk it opens the
              file picker and accepts a drop. */}
          <button
            type="button"
            onClick={cameraFirst ? openCamera : openPicker}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              accept(event.dataTransfer.files?.[0]);
            }}
            className={[
              "flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-5 rounded-sm border px-6 py-10 sm:py-20",
              "transition-all duration-1200 ease-calm",
              // Dashed says "you may drop something here"; on a phone there is
              // nothing to drop, so the panel is simply a surface to press.
              cameraFirst ? "border-day-line bg-day-soft/70" : "border-dashed",
              dragging
                ? "border-olive/60 bg-olive-pale/60"
                : "border-day-line hover:border-ink/25 hover:bg-day-soft/50",
            ].join(" ")}
          >
            {cameraFirst ? (
              <Glyph name="camera" className="h-10 w-10 text-tekhelet" />
            ) : (
              <BlankSticker />
            )}
            <span
              className={
                cameraFirst
                  ? "text-base text-ink"
                  : "max-w-xs text-center text-sm leading-relaxed text-ink-muted"
              }
            >
              {cameraFirst ? t("contribute.openCamera") : t("contribute.dropzone")}
            </span>
          </button>

          {/* The other way in, kept quiet. */}
          {cameraFirst ? (
            <Action tone="quiet" size="sm" className="shrink-0 self-center" onPress={openPicker}>
              {t("contribute.dropzoneMobile")}
            </Action>
          ) : (
            hasCamera && (
              <Action
                tone="ghost"
                className="shrink-0 self-start"
                onPress={openCamera}
                startContent={<Glyph name="camera" />}
              >
                {t("contribute.openCamera")}
              </Action>
            )
          )}
        </div>
      )}

      {rejected && (
        <p className="mt-4 shrink-0 animate-fade text-sm text-sun-deep">
          {t(rejected === "size" ? "contribute.tooLarge" : "contribute.notImage")}
        </p>
      )}

      <CameraCapture isOpen={camera} onCapture={captured} onClose={() => setCamera(false)} />
      <PhotoEditor
        isOpen={editing}
        src={preview}
        name={name}
        onApply={edited}
        onClose={() => setEditing(false)}
      />
    </div>
  );
}
