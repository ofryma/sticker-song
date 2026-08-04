import { useRef, useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { formatBytes } from "../../lib/format.js";
import { rejectReason } from "../../hooks/useStickerDraft.js";
import { Action } from "../ui/Action.jsx";

/** Photo picker: drag-and-drop on a desktop, camera or gallery on a phone. */
export function PhotoField({ file, preview, onPick }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState(null);

  const accept = (candidate) => {
    if (!candidate) return;
    const reason = rejectReason(candidate);
    setRejected(reason);
    if (!reason) onPick(candidate);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => accept(event.target.files?.[0])}
      />

      {preview ? (
        <figure className="animate-fade">
          <div className="overflow-hidden rounded-sm border border-day-line bg-day">
            <img src={preview} alt="" className="max-h-[52vh] w-full animate-fade object-contain" />
          </div>
          <figcaption className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
            <span className="truncate">{file?.name}</span>
            {file && <span>{formatBytes(file.size)}</span>}
            <Action
              tone="quiet"
              size="sm"
              className="ms-auto"
              onPress={() => inputRef.current?.click()}
            >
              {t("contribute.replace")}
            </Action>
            <Action tone="quiet" size="sm" onPress={() => onPick(null)}>
              {t("contribute.remove")}
            </Action>
          </figcaption>
        </figure>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
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
            "flex w-full flex-col items-center justify-center gap-5 rounded-sm border border-dashed px-6 py-20",
            "transition-all duration-1200 ease-calm",
            dragging
              ? "border-olive/60 bg-olive-pale/60"
              : "border-day-line hover:border-ink/25 hover:bg-day-soft/50",
          ].join(" ")}
        >
          {/* A blank sticker, waiting on the wall. */}
          <svg viewBox="0 0 48 48" className="h-11 w-11 text-ink-muted" fill="none">
            <path
              d="M8 8h24l8 8v24H8z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path d="M32 8v8h8" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <circle cx="19" cy="24" r="3.5" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M12 34l7-6 6 5 5-4 6 5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span className="max-w-xs text-center text-sm leading-relaxed text-ink-muted">
            <span className="hidden sm:inline">{t("contribute.dropzone")}</span>
            <span className="sm:hidden">{t("contribute.dropzoneMobile")}</span>
          </span>
        </button>
      )}

      {rejected && (
        <p className="mt-4 animate-fade text-sm text-sun-deep">
          {t(rejected === "size" ? "contribute.tooLarge" : "contribute.notImage")}
        </p>
      )}
    </div>
  );
}
