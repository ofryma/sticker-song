import { useState } from "react";
import { Card, CardBody } from "@heroui/react";
import { Action } from "../ui/Action.jsx";
import { useI18n } from "../../i18n/index.jsx";
import { formatCoords } from "../../lib/format.js";

/** Optional GPS. Requires a secure context, so failure has to read gently. */
export function LocationField({ latitude, longitude, onChange }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("idle"); // idle | locating | denied | unavailable
  const coords = formatCoords(latitude, longitude);

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords: found }) => {
        onChange({ latitude: found.latitude, longitude: found.longitude });
        setStatus("idle");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  if (coords) {
    return (
      <Card
        shadow="none"
        radius="sm"
        className="animate-fade border border-day-line/80 bg-day-soft/70"
      >
        <CardBody className="flex flex-row flex-wrap items-center gap-4 px-5 py-4">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-olive"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm text-ink">{t("contribute.locationSet")}</p>
            <p className="mt-0.5 font-mono text-xs text-ink-muted">{coords}</p>
          </div>
          <Action
            tone="quiet"
            size="sm"
            className="ms-auto text-xs"
            onPress={() => onChange({ latitude: null, longitude: null })}
          >
            {t("contribute.locationClear")}
          </Action>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Action
        tone="ghost"
        onPress={locate}
        isLoading={status === "locating"}
        className="self-start"
      >
        {status === "locating" ? t("contribute.locating") : t("contribute.useLocation")}
      </Action>
      {(status === "denied" || status === "unavailable") && (
        <p className="animate-fade text-sm text-ink-muted">
          {t(status === "denied" ? "contribute.locationDenied" : "contribute.locationUnavailable")}
        </p>
      )}
    </div>
  );
}
