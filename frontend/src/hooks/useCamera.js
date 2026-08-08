import { useCallback, useEffect, useRef, useState } from "react";

const CONSTRAINTS = {
  audio: false,
  // The back camera is the one pointed at a wall; ask for plenty of detail so
  // small printed text on a sticker survives the JPEG.
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1920 },
  },
};

const QUALITY = 0.92;

/** True where the browser can hand us a live camera at all. */
export function cameraSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** A permission failure reads differently from a missing camera. */
function statusFor(cause) {
  const name = cause?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "unavailable";
  return "error";
}

function filename() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `sticker-${stamp}.jpg`;
}

/**
 * A live viewfinder for a `<video>` the caller renders. Every way this can fail
 * — no camera, refused permission, an insecure page — ends in a status the
 * caller can put into plain words, because choosing a file is always still there.
 */
export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // idle | starting | live | denied | unavailable | error
  const [status, setStatus] = useState("idle");
  const [mirrored, setMirrored] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    if (!cameraSupported()) {
      setStatus("unavailable");
      return;
    }
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      streamRef.current = stream;
      // A front camera is a mirror to whoever holds it, a back camera a window.
      // Only the preview flips: the saved photograph never does, or the writing
      // on the sticker would come out backwards.
      const facing = stream.getVideoTracks?.()[0]?.getSettings?.().facingMode;
      setMirrored(facing !== "environment");
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play?.()?.catch?.(() => {});
      }
      setStatus("live");
    } catch (cause) {
      stop();
      setStatus(statusFor(cause));
    }
  }, [stop]);

  /** The current frame as a real File, so it behaves like a chosen photo. */
  const capture = useCallback(async () => {
    const video = videoRef.current;
    const width = video?.videoWidth ?? 0;
    const height = video?.videoHeight ?? 0;
    if (!width || !height) return null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", QUALITY);
    });
    if (!blob) return null;
    return new File([blob], filename(), { type: "image/jpeg" });
  }, []);

  // The camera light must never outlive the viewfinder.
  useEffect(() => stop, [stop]);

  return { videoRef, status, mirrored, start, stop, capture };
}
