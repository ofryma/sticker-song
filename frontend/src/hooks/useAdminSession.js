import { useCallback, useEffect, useState } from "react";
import * as admin from "../lib/admin.js";

/**
 * The reviewer's sign-in state.
 * `status` is one of "checking" | "anonymous" | "ready".
 */
export function useAdminSession() {
  const [token, setToken] = useState(() => admin.readToken());
  const [status, setStatus] = useState(token ? "checking" : "anonymous");
  const [error, setError] = useState(null);

  // A stored token may have expired while the tab was closed.
  useEffect(() => {
    if (status !== "checking" || !token) return;
    let cancelled = false;
    admin
      .checkSession(token)
      .then(() => !cancelled && setStatus("ready"))
      .catch(() => {
        if (cancelled) return;
        admin.signOut();
        setToken(null);
        setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, [status, token]);

  const signIn = useCallback(async (credentials) => {
    setError(null);
    try {
      const session = await admin.signIn(credentials);
      setToken(session.token);
      setStatus("ready");
    } catch (cause) {
      setError(cause);
      throw cause;
    }
  }, []);

  const signOut = useCallback(() => {
    admin.signOut();
    setToken(null);
    setStatus("anonymous");
    setError(null);
  }, []);

  /** Called when any request comes back 401: the token died mid-session. */
  const expire = useCallback(() => {
    admin.signOut();
    setToken(null);
    setStatus("anonymous");
  }, []);

  return { token, status, error, signIn, signOut, expire };
}
