"use client";

import { ArrowUp, Square } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";

export const MAX_LEN = 500;

/** Auto-growing message box. Enter sends, Shift+Enter adds a line, Stop cancels a streaming answer. */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!busy && value.trim()) onSend();
    }
  };

  const remaining = MAX_LEN - value.length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && value.trim()) onSend();
      }}
      className="rounded-[26px] border border-line bg-surface p-2 pl-4 shadow-[0_8px_30px_rgb(0_0_0/0.06)] transition-colors duration-200 focus-within:border-muted/60"
    >
      <label htmlFor={id} className="sr-only">
        Message AirWise
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={id}
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX_LEN}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="max-h-[200px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 placeholder:text-muted focus:outline-none"
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-surface"
            aria-label="Stop generating"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-surface transition-opacity duration-200 disabled:opacity-25"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {remaining < 80 && (
        <p className="px-1 pb-1 text-right text-caption text-muted">{remaining} characters left</p>
      )}
    </form>
  );
}
