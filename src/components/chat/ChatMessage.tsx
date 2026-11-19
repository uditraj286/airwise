"use client";

import { spellOutUnits } from "@/lib/units";
import { Check, Copy, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/layout/Logo";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { toPlainText } from "@/lib/ai/plainText";

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

/** One message. User: soft right-aligned bubble. Assistant: plain text beside the AirWise mark, with actions. */
export function ChatMessage({
  turn,
  streaming,
  isLast,
  onRetry,
}: {
  turn: Turn;
  streaming: boolean;
  isLast: boolean;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (turn.role === "user") {
    return (
      <li className="animate-in flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-subtle px-4 py-2.5 text-[15px] leading-relaxed">
          <span className="sr-only">You: </span>
          {turn.text}
        </p>
      </li>
    );
  }

  const text = spellOutUnits(toPlainText(turn.text));
  const thinking = streaming && text.length === 0;

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <li className="animate-in group flex gap-3">
      <span
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-surface"
        aria-hidden="true"
      >
        <Logo className="h-4 w-4 text-brand" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="sr-only">AirWise: </span>
        {thinking ? (
          <ThinkingIndicator />
        ) : (
          <p className={`whitespace-pre-wrap text-[15px] leading-7 ${streaming ? "stream-caret" : ""}`}>
            {text}
          </p>
        )}
        {!streaming && text && (
          <div
            className={`mt-1 flex gap-1 transition-opacity duration-200 ${isLast ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
          >
            <button
              type="button"
              onClick={() => void copy()}
              className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink"
              aria-label={copied ? "Copied" : "Copy answer"}
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {isLast && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink"
                aria-label="Retry this answer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
