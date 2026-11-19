"use client";

import { Card } from "@/components/ui/Card";
import { useAlerts } from "@/lib/useAlerts";

/** Settings card for smog alerts (browser notifications while AirWise is open). */
export function AlertsSettings() {
  const { enabled, permission, enable, disable } = useAlerts();
  return (
    <Card>
      <h2 className="text-lg font-medium">Smog alerts</h2>
      <p className="mt-1 text-sm text-muted">
        A notification when the cleanest air of the day is about to start, when smog is about to turn Very
        Poor, and when a plan step is due. Alerts arrive while AirWise is open in a tab; the bell at the top
        always lists them.
      </p>
      <div className="mt-4">
        {permission === "unsupported" ? (
          <p className="text-sm text-muted">This browser can&apos;t show notifications.</p>
        ) : permission === "denied" ? (
          <p className="text-sm text-muted">
            Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then
            come back.
          </p>
        ) : enabled ? (
          <button
            type="button"
            onClick={disable}
            className="rounded-full border border-line px-4 py-2 text-sm hover:border-muted"
          >
            Turn alerts off
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void enable()}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-onbrand hover:bg-brand-strong"
          >
            Turn on alerts
          </button>
        )}
      </div>
    </Card>
  );
}
