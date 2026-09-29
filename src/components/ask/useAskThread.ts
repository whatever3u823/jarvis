"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskEvent } from "@/lib/rag/ask";
import type { Passage } from "@/lib/rag/passages";
import type { CitationCheck, QuoteCheck } from "@/lib/rag/verify";

export interface TrailStep {
  kind: "search" | "read";
  text: string;
  found?: number;
}

export interface AskTurnState {
  id: string;
  question: string;
  status: string | null;
  trail: TrailStep[];
  /** Text written between research steps (rare; shown as notes). */
  notes: string[];
  answer: string;
  passages: Passage[];
  done: boolean;
  error: string | null;
  citations: CitationCheck | null;
  quotes: QuoteCheck[];
  usage: { inputTokens: number; outputTokens: number; rounds: number } | null;
  startedAt: number;
  finishedAt: number | null;
}

async function* readNdjson(res: Response): AsyncGenerator<AskEvent> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) yield JSON.parse(line) as AskEvent;
    }
  }
  if (buf.trim()) yield JSON.parse(buf) as AskEvent;
}

function storageKey(scope: string) {
  return `jarvis.ask.${scope}`;
}

/**
 * A research thread: each question streams retrieval steps, an answer and its
 * sources. Follow-up questions carry the earlier answers and the passages they
 * cited, so "what about in Book II?" keeps its context. The thread survives
 * navigation within the tab (sessionStorage).
 */
export function useAskThread(scopeKey: string, documentIds?: string[]) {
  const [turns, setTurns] = useState<AskTurnState[]>([]);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const turnsRef = useRef<AskTurnState[]>([]);
  turnsRef.current = turns;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(scopeKey));
      if (raw) setTurns((JSON.parse(raw) as AskTurnState[]).filter((t) => t.done || t.error));
    } catch {}
    setLoaded(true);
  }, [scopeKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      const settled = turns.filter((t) => t.done || t.error);
      sessionStorage.setItem(storageKey(scopeKey), JSON.stringify(settled));
    } catch {}
  }, [turns, loaded, scopeKey]);

  const busy = turns.some((t) => !t.done && !t.error);

  const ask = useCallback(
    async (question: string) => {
      if (!question.trim()) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const previous = turnsRef.current.filter((t) => t.done && t.answer);
      const history = previous.slice(-6).map((t) => ({ question: t.question, answer: t.answer }));
      const cited = new Map<string, { id: string; chunkId: number | null; documentId: string; page: number }>();
      for (const t of previous.slice(-6))
        for (const id of t.citations?.cited ?? []) {
          const p = t.passages.find((x) => x.id === id);
          if (p) cited.set(id, { id, chunkId: p.chunkId, documentId: p.documentId, page: p.pageStart });
        }

      const id = `${Date.now()}`;
      const fresh: AskTurnState = {
        id,
        question,
        status: "Searching the library",
        trail: [],
        notes: [],
        answer: "",
        passages: [],
        done: false,
        error: null,
        citations: null,
        quotes: [],
        usage: null,
        startedAt: Date.now(),
        finishedAt: null,
      };
      setTurns((ts) => [...ts, fresh]);
      const patch = (fn: (t: AskTurnState) => AskTurnState) => setTurns((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));

      // Batch text deltas per animation frame.
      let pending = "";
      let raf = 0;
      const flush = () => {
        raf = 0;
        if (!pending) return;
        const chunk = pending;
        pending = "";
        patch((t) => ({ ...t, answer: t.answer + chunk, status: null }));
      };

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question, documentIds, history, priorPassages: [...cited.values()] }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `Request failed (${res.status})`);
        }
        for await (const e of readNdjson(res)) {
          switch (e.type) {
            case "status":
              patch((t) => ({ ...t, status: e.text }));
              break;
            case "search":
              patch((t) => ({ ...t, trail: [...t.trail, { kind: "search", text: e.books.length ? `${e.query} — in ${e.books.join(", ")}` : e.query, found: e.found }] }));
              break;
            case "read":
              patch((t) => ({ ...t, trail: [...t.trail, { kind: "read", text: `${e.book}, ${e.pages}` }] }));
              break;
            case "passages":
              patch((t) => ({ ...t, passages: e.passages }));
              break;
            case "turn":
              flush();
              patch((t) => (t.answer.trim() ? { ...t, notes: [...t.notes, t.answer], answer: "" } : t));
              break;
            case "text":
              pending += e.delta;
              if (!raf) raf = requestAnimationFrame(flush);
              break;
            case "done":
              if (raf) cancelAnimationFrame(raf);
              pending = "";
              patch((t) => ({
                ...t,
                answer: e.answer,
                citations: e.citations,
                quotes: e.quotes,
                usage: e.usage,
                done: true,
                status: null,
                finishedAt: Date.now(),
              }));
              break;
            case "error":
              flush();
              patch((t) => ({ ...t, error: e.message, status: null, finishedAt: Date.now() }));
              break;
          }
        }
        flush();
        patch((t) => (t.done || t.error ? t : { ...t, error: "The answer stream ended unexpectedly.", status: null }));
      } catch (err) {
        if (controller.signal.aborted) {
          patch((t) => (t.done ? t : { ...t, error: "Stopped.", status: null }));
          return;
        }
        patch((t) => ({ ...t, error: err instanceof Error ? err.message : String(err), status: null }));
      }
    },
    [documentIds],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
  }, []);

  return { turns, ask, stop, reset, busy, loaded };
}
