import { useCallback, useEffect, useState } from "react";
import * as admin from "../lib/admin.js";

/**
 * The state of the copies on the drive.
 *
 * Read once when the tab opens, and again only when asked: the nightly run is
 * hours away, and a panel that polls would be pretending otherwise.
 */
export function useBackups({ token, onExpired }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    admin
      .backups(token)
      .then((next) => {
        if (cancelled) return;
        setError(null);
        setStatus(next);
      })
      .catch((cause) => {
        if (cancelled) return;
        if (cause?.code === "unauthorized") onExpired();
        else setError(cause);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce, onExpired, token]);

  const reload = useCallback(() => {
    setError(null);
    setNonce((value) => value + 1);
  }, []);

  return {
    status,
    state: error ? "error" : status ? "ready" : "loading",
    error,
    reload,
  };
}
