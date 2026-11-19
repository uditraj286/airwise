"use client";

import { Baby, Footprints, HousePlus, PenSquare, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { ChatMessage, type Turn } from "@/components/chat/ChatMessage";
import { Composer, MAX_LEN } from "@/components/chat/Composer";
import { Logo } from "@/components/layout/Logo";
import { createStore, todayKey, useProfile } from "@/lib/profile/store";

const SUGGESTIONS = [
  { icon: Baby, title: "Can the kids play outside?", detail: "after school today" },
  { icon: Footprints, title: "When should Dadi walk?", detail: "safest time this morning or evening" },
  { icon: HousePlus, title: "Is an air purifier worth it?", detail: "for a 3×4 m bedroom" },
  { icon: Users, title: "What can our society do?", detail: "together, this week" },
];

const HistorySchema = z.object({
  date: z.string(),
  turns: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(40),
});
const historyStore = createStore<z.infer<typeof HistorySchema> | null>(
  "airwise.chat.v1",
  HistorySchema.nullable(),
  null,
);

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Chat grounded in live air data and the household; streams plain-text answers. */
export function ChatView() {
  const { profile, isDemo } = useProfile();
  const saved = useSyncExternalStore(historyStore.subscribe, historyStore.read, () => null);
  const turns: Turn[] = saved && saved.date === todayKey() ? saved.turns : [];
  const setTurns = useCallback((update: (t: Turn[]) => Turn[]) => {
    const current = historyStore.read();
    const base = current && current.date === todayKey() ? current.turns : [];
    historyStore.write({ date: todayKey(), turns: update(base).slice(-40) });
  }, []);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const lastLength = turns.at(-1)?.text.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length, lastLength]);

  const ask = async (question: string, history: Turn[]): Promise<void> => {
    const message = question.trim().slice(0, MAX_LEN);
    if (!message || busy) return;
    setError(null);
    setBusy(true);
    setInput("");
    setTurns(() => [...history, { role: "user", text: message }, { role: "assistant", text: "" }]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          message,
          history: history.slice(-6),
          tzOffsetMin: new Date().getTimezoneOffset(),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "The assistant is unavailable right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setTurns((t) => {
          const next = t.slice();
          const last = next[next.length - 1];
          if (last) next[next.length - 1] = { ...last, text: last.text + chunk };
          return next;
        });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
        setTurns((t) => (t.at(-1)?.text ? t : t.slice(0, -2)));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const retry = (): void => {
    const lastUser = [...turns].reverse().find((t) => t.role === "user");
    if (!lastUser) return;
    const cut = turns.lastIndexOf(lastUser);
    void ask(lastUser.text, turns.slice(0, cut));
  };

  const empty = turns.length === 0;
  const name = isDemo ? "" : `, ${profile.members[0]?.name ?? ""}`;

  return (
    <div className="card mx-auto flex min-h-[calc(100dvh-9rem)] max-w-4xl flex-col px-4 pt-4 sm:px-8">
      <div className="flex items-center justify-between pb-2">
        <p className="text-caption text-muted">
          Answers use live air data for {profile.location.name.split(",")[0]} and your household.
        </p>
        {!empty && (
          <button
            type="button"
            onClick={() => {
              abortRef.current?.abort();
              historyStore.write(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label text-muted hover:bg-subtle hover:text-ink"
          >
            <PenSquare className="h-4 w-4" aria-hidden="true" />
            New chat
          </button>
        )}
      </div>

      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <span className="animate-in grid h-12 w-12 place-items-center rounded-2xl border border-line">
            <Logo className="h-7 w-7 text-brand" />
          </span>
          <h1 className="animate-in mt-5 text-2xl font-semibold tracking-tight sm:text-[32px]">
            {greeting()}
            {name}. What would you like to know?
          </h1>
          <p className="animate-in mt-2 max-w-md text-label text-muted">
            Ask about timing, health, your home or cleaner habits. Not medical advice.
          </p>
          <ul className="mt-8 grid w-full gap-3 sm:grid-cols-2">
            {SUGGESTIONS.map(({ icon: Icon, title, detail }, i) => (
              <li key={title} className="animate-in" style={{ animationDelay: `${80 + i * 60}ms` }}>
                <button
                  type="button"
                  onClick={() => void ask(`${title} (${detail})`, [])}
                  className="flex w-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors duration-200 hover:border-brand/50 hover:bg-brand/5"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    <span className="block text-label font-medium">{title}</span>
                    <span className="block text-caption text-muted">{detail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ol className="flex flex-1 flex-col gap-6 py-4" aria-label="Conversation" aria-busy={busy}>
          {turns.map((turn, i) => (
            <ChatMessage
              key={i}
              turn={turn}
              streaming={busy && i === turns.length - 1}
              isLast={i === turns.length - 1}
              onRetry={retry}
            />
          ))}
        </ol>
      )}
      <div ref={endRef} />

      {error && (
        <p role="alert" className="mb-2 rounded-xl bg-bad/10 px-3 py-2 text-label text-bad">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 z-10 bg-gradient-to-t from-surface via-surface to-transparent pb-2 pt-4">
        <Composer
          value={input}
          onChange={setInput}
          onSend={() => void ask(input, turns)}
          onStop={() => abortRef.current?.abort()}
          busy={busy}
          placeholder={empty ? "Ask anything about today's air…" : "Reply to AirWise…"}
        />
        <p className="mt-2 text-center text-caption text-muted">
          AirWise can make mistakes. For breathing trouble, contact a doctor.
        </p>
      </div>
    </div>
  );
}
