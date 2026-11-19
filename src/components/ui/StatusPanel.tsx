import { AlertTriangle, Loader2 } from "lucide-react";

/** Loading / error states announced to assistive technology. */
export function StatusPanel({
  kind,
  message,
  onRetry,
  retryLabel = "Retry",
}: {
  kind: "loading" | "error";
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className="card flex items-center gap-3 p-5 text-sm">
      {kind === "loading" ? (
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-5 w-5 text-bad" aria-hidden="true" />
      )}
      <p className="flex-1">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-line px-4 py-1.5 hover:border-muted"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
