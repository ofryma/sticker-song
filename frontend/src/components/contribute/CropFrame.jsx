import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/index.jsx";

/* Corners and edges of a rectangle on screen. This is geometry, not reading
   order, so it stays physical when the interface flips to Hebrew. */
const HANDLES = [
  ["nw", "-top-1.5 -left-1.5 cursor-nwse-resize"],
  ["n", "-top-1.5 left-1/2 -ml-1.5 cursor-ns-resize"],
  ["ne", "-top-1.5 -right-1.5 cursor-nesw-resize"],
  ["e", "top-1/2 -right-1.5 -mt-1.5 cursor-ew-resize"],
  ["se", "-bottom-1.5 -right-1.5 cursor-nwse-resize"],
  ["s", "-bottom-1.5 left-1/2 -ml-1.5 cursor-ns-resize"],
  ["sw", "-bottom-1.5 -left-1.5 cursor-nesw-resize"],
  ["w", "top-1/2 -left-1.5 -mt-1.5 cursor-ew-resize"],
];

const pct = (value) => `${value * 100}%`;

/**
 * The largest box of a given shape that fits the room the sheet has left. The
 * frame has to match the photograph exactly — a drag is measured against it —
 * so it is measured rather than left to the aspect-ratio of a stretched box.
 */
function useFitted(ratio) {
  const roomRef = useRef(null);
  const [size, setSize] = useState(null);

  useEffect(() => {
    const room = roomRef.current;
    if (!room) return undefined;
    const measure = () => {
      const bounds = room.getBoundingClientRect();
      const width = Math.min(bounds.width, bounds.height * ratio);
      setSize({ width, height: width / ratio });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(room);
    return () => observer.disconnect();
  }, [ratio]);

  return [roomRef, size];
}

/** The four pieces of daylight wash over everything the crop leaves out. */
function outside(crop) {
  return [
    { left: 0, top: 0, width: "100%", height: pct(crop.y) },
    { left: 0, top: pct(crop.y + crop.h), width: "100%", height: pct(1 - crop.y - crop.h) },
    { left: 0, top: pct(crop.y), width: pct(crop.x), height: pct(crop.h) },
    {
      left: pct(crop.x + crop.w),
      top: pct(crop.y),
      width: pct(1 - crop.x - crop.w),
      height: pct(crop.h),
    },
  ];
}

/** The photograph, turned, with the crop rectangle laid over it. */
export function CropFrame({ src, frame, rotation, flipped, crop, box }) {
  const { t } = useI18n();
  const [roomRef, size] = useFitted(frame.width / frame.height);
  const quarter = rotation % 180 !== 0;

  return (
    <div ref={roomRef} className="flex h-[46svh] items-center justify-center sm:h-[54vh]">
      <div
        data-crop-frame=""
        onPointerMove={box.move}
        onPointerUp={box.end}
        onPointerCancel={box.end}
        className="relative touch-none overflow-hidden rounded-sm border border-day-line bg-day select-none"
        style={size ? { width: size.width, height: size.height } : { width: "100%" }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute top-1/2 left-1/2 max-w-none animate-fade"
          style={{
            // A quarter turn puts the photograph's width along the frame's
            // height, so it is sized from the frame's other side.
            width: quarter ? pct(frame.height / frame.width) : "100%",
            // The mirror is written after the turn so it is read before it: the
            // photograph turns first, then flips across the frame's own axis.
            transform: `translate(-50%, -50%) scaleX(${flipped ? -1 : 1}) rotate(${rotation}deg)`,
            transition: "transform 700ms var(--ease-calm)",
          }}
        />

        {outside(crop).map((piece, index) => (
          <div key={index} className="absolute bg-day/72" style={piece} aria-hidden="true" />
        ))}

        <div
          role="group"
          tabIndex={0}
          aria-label={t("contribute.cropBox")}
          onPointerDown={box.begin("move")}
          onKeyDown={box.key}
          className="absolute cursor-move border border-ink/50 focus-visible:ring-2 focus-visible:ring-tekhelet"
          style={{
            left: pct(crop.x),
            top: pct(crop.y),
            width: pct(crop.w),
            height: pct(crop.h),
          }}
        >
          {/* Thirds, faint — a framing aid, not a grid to obey. */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute top-1/3 h-px w-full bg-day/70" />
            <div className="absolute top-2/3 h-px w-full bg-day/70" />
            <div className="absolute left-1/3 h-full w-px bg-day/70" />
            <div className="absolute left-2/3 h-full w-px bg-day/70" />
          </div>

          {HANDLES.map(([handle, where]) => (
            <span
              key={handle}
              onPointerDown={box.begin(handle)}
              aria-hidden="true"
              className={`absolute h-3 w-3 rounded-[2px] border border-ink/45 bg-day ${where}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
