"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Passage } from "@/lib/rag/passages";
import { chapterLeaf, pageRange } from "@/lib/shared/format";
import { useReader } from "../reader/ReaderDrawer";
import { AnswerBody } from "./AnswerBody";
import { useAskThread, type AskTurnState } from "./useAskThread";

interface Props {
  /** Restrict to these documents ("Ask this book"); omit for the whole library. */
  scope?: { documentIds: string[]; title: string };
  initialQuestion?: string;
  suggestions?: string[];
}

export function AskPanel({ scope, initialQuestion, suggestions }: Props) {
  const scopeKey = scope ? scope.documentIds.join(",") : "library";
  const documentIds = useMemo(() => scope?.documentIds, [scope?.documentIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const { turns, ask, stop, reset, busy, loaded } = useAskThread(scopeKey, documentIds);
  const [draft, setDraft] = useState("");
  const askedInitial = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-ask a question passed in the URL, once.
  useEffect(() => {
    if (!loaded || !initialQuestion || askedInitial.current === initialQuestion) return;
    askedInitial.current = initialQuestion;
    const last = turns[turns.length - 1];
    if (last?.question === initialQuestion) return;
    void ask(initialQuestion);
  }, [loaded, initialQuestion, ask, turns]);

  const count = turns.length;
  useEffect(() => {
    if (count > 0) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count]);

  const submit = () => {
    const q = draft.trim();
    if (!q || busy) return;
    setDraft("");
    void ask(q);
  };

  return (
    <div className="flex flex-col">
      {turns.length === 0 && loaded && !initialQuestion && (
        <Intro scope={scope} suggestions={suggestions} onPick={(q) => void ask(q)} />
      )}

      <div className="space-y-16">
        {turns.map((t) => (
          <Turn key={t.id} turn={t} onStop={stop} />
        ))}
      </div>
      <div ref={endRef} />

      <div className={`sticky bottom-0 z-10 -mx-4 bg-gradient-to-t from-ink via-ink to-transparent px-4 pt-8 pb-6 ${turns.length ? "mt-10" : "mt-2"}`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-end gap-3 border border-line-strong bg-panel px-4 py-3 transition-colors focus-within:border-brass-dim"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={Math.min(6, Math.max(1, draft.split("\n").length))}
            placeholder={
              turns.length
                ? "Ask a follow-up…"
                : scope
                  ? `Ask about ${scope.title.length > 48 ? "this volume" : `“${scope.title}”`}…`
                  : "Ask the library a question…"
            }
            className="max-h-48 min-h-[28px] flex-1 resize-none bg-transparent font-serif text-[18px] leading-relaxed text-ivory outline-none placeholder:text-faint"
          />
          <div className="flex shrink-0 items-center gap-3 pb-1 font-mono text-[10.5px] tracking-[0.14em] uppercase">
            {turns.length > 0 && !busy && (
              <button type="button" onClick={reset} className="text-faint hover:text-parchment">
                New thread
              </button>
            )}
            {busy ? (
              <button type="button" onClick={stop} className="text-rust hover:text-ivory">
                Stop
              </button>
            ) : (
              <button type="submit" disabled={!draft.trim()} className="text-brass hover:text-brass-bright disabled:text-faint">
                Ask ↵
              </button>
            )}
          </div>
        </form>
        <p className="mt-2 font-mono text-[10px] tracking-wide text-faint">
          Answers are drawn from {scope ? "this volume" : "your library"} and cite their sources. Interpretation is marked as synthesis.
        </p>
      </div>
    </div>
  );
}

function Intro({ scope, suggestions, onPick }: { scope?: Props["scope"]; suggestions?: string[]; onPick: (q: string) => void }) {
  const qs =
    suggestions ??
    (scope
      ? ["What are the central ideas introduced in this book?", "How is the argument structured?", "Which passages best capture its main theme?"]
      : [
          "Which books in my library discuss self-mastery?",
          "How do the authors in my library differ in their views of suffering?",
          "What themes appear repeatedly across my books?",
        ]);
  return (
    <div className="mb-8 animate-fade-in">
      <p className="max-w-2xl font-serif text-[19px] leading-relaxed text-parchment">
        {scope
          ? "Questions are answered from this volume alone. Every claim is tied to a passage you can open at its page."
          : "Questions are answered from the books on your shelves, drawing passages from as many volumes as the question needs. Every claim is tied to a passage you can open at its page."}
      </p>
      <div className="mt-8">
        <div className="label mb-3">For instance</div>
        <ul className="divide-y divide-line border-y border-line">
          {qs.map((q) => (
            <li key={q}>
              <button onClick={() => onPick(q)} className="group flex w-full items-center justify-between py-3 text-left">
                <span className="font-display text-[20px] text-parchment italic transition-colors group-hover:text-ivory">{q}</span>
                <span className="font-mono text-xs text-faint transition-colors group-hover:text-brass">→</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Turn({ turn, onStop }: { turn: AskTurnState; onStop: () => void }) {
  const streaming = !turn.done && !turn.error;
  const cited = useMemo(() => {
    const byId = new Map(turn.passages.map((p) => [p.id, p]));
    const order: Passage[] = [];
    const seen = new Set<string>();
    const ids = turn.citations?.cited ?? [...turn.answer.matchAll(/P\d+/g)].map((m) => m[0]);
    for (const id of ids) {
      const p = byId.get(id);
      if (p && !seen.has(id)) {
        seen.add(id);
        order.push(p);
      }
    }
    return order;
  }, [turn.passages, turn.citations, turn.answer]);
  const uncited = turn.passages.filter((p) => !cited.includes(p));
  const failedQuotes = turn.quotes.filter((q) => !q.verified);
  const seconds = turn.finishedAt ? ((turn.finishedAt - turn.startedAt) / 1000).toFixed(1) : null;

  return (
    <article className="animate-rise">
      <h2 className="font-display text-[30px] leading-[1.2] text-ivory italic md:text-[34px]">{turn.question}</h2>

      {(turn.trail.length > 0 || turn.status) && (
        <ol className="mt-5 space-y-1 border-l border-line pl-4 font-mono text-[11px] text-muted">
          {turn.trail.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-faint">{s.kind === "search" ? "⌕" : "▤"}</span>
              <span className="min-w-0">
                {s.kind === "search" ? (
                  <>
                    searched <span className="text-parchment">“{s.text}”</span> · {s.found} passages
                  </>
                ) : (
                  <>
                    read <span className="text-parchment">{s.text}</span>
                  </>
                )}
              </span>
            </li>
          ))}
          {turn.status && (
            <li className="flex items-center gap-2 text-brass">
              <span className="animate-pulse-soft">◆</span>
              {turn.status}
              {streaming && (
                <button onClick={onStop} className="ml-3 text-faint uppercase hover:text-parchment">
                  stop
                </button>
              )}
            </li>
          )}
        </ol>
      )}

      {turn.notes.length > 0 && (
        <div className="mt-4 space-y-2 font-serif text-[15px] text-muted italic">
          {turn.notes.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}

      {turn.answer && (
        <div className="mt-7">
          <AnswerBody text={turn.answer} passages={turn.passages} streaming={streaming} />
        </div>
      )}

      {turn.error && (
        <div className="mt-6 border border-rust/40 bg-rust/5 px-4 py-3 text-[14px] text-parchment">
          <span className="mr-2 font-mono text-[10.5px] tracking-[0.14em] text-rust uppercase">Unable to answer</span>
          {turn.error}
        </div>
      )}

      {turn.done && (
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 font-mono text-[10.5px] tracking-wide text-faint">
          <span>
            {cited.length} {cited.length === 1 ? "source" : "sources"} cited · {turn.passages.length} passages consulted
          </span>
          {turn.quotes.length > 0 && (
            <span className={failedQuotes.length ? "text-rust" : "text-sage"}>
              {turn.quotes.length - failedQuotes.length}/{turn.quotes.length} quotations verified against the text
            </span>
          )}
          {(turn.citations?.unknown.length ?? 0) > 0 && (
            <span className="text-rust">{turn.citations!.unknown.length} invalid citation(s) flagged</span>
          )}
          {seconds && <span>{seconds}s</span>}
        </div>
      )}
      {failedQuotes.length > 0 && (
        <div className="mt-3 border-l border-rust/60 pl-4 text-[13px] text-muted">
          <div className="mb-1 font-mono text-[10px] tracking-[0.14em] text-rust uppercase">Not found verbatim in the retrieved text</div>
          {failedQuotes.map((q, i) => (
            <p key={i} className="font-serif italic">
              “{q.quote}”
            </p>
          ))}
        </div>
      )}

      {(cited.length > 0 || (turn.error && turn.passages.length > 0)) && (
        <Sources title={cited.length ? "Sources" : "Passages retrieved"} passages={cited.length ? cited : turn.passages.slice(0, 10)} />
      )}
      {turn.done && uncited.length > 0 && <Consulted passages={uncited} />}
    </article>
  );
}

function Sources({ title, passages }: { title: string; passages: Passage[] }) {
  return (
    <section className="mt-8">
      <div className="label mb-3">{title}</div>
      <ol className="divide-y divide-line border-y border-line">
        {passages.map((p) => (
          <SourceRow key={p.id} p={p} />
        ))}
      </ol>
    </section>
  );
}

function SourceRow({ p }: { p: Passage }) {
  const { open } = useReader();
  return (
    <li>
      <button
        onClick={() => open({ documentId: p.documentId, title: p.title, author: p.author, chapter: p.chapter, page: p.pageStart, chunkId: p.chunkId })}
        className="group grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 py-3.5 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[15.5px] text-ivory group-hover:text-brass-bright">{p.title}</span>
            {p.author && <span className="truncate text-[12px] text-muted">{p.author}</span>}
          </div>
          <p className="mt-1 line-clamp-2 font-serif text-[14.5px] leading-relaxed text-muted">{p.text}</p>
        </div>
        <div className="text-right font-mono text-[10.5px] tracking-wide text-faint uppercase">
          <div className="text-parchment">{pageRange(p)}</div>
          {chapterLeaf(p.chapter) && <div className="mt-1 max-w-[12rem] truncate normal-case">{chapterLeaf(p.chapter)}</div>}
        </div>
      </button>
    </li>
  );
}

function Consulted({ passages }: { passages: Passage[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button onClick={() => setOpen((v) => !v)} className="font-mono text-[10.5px] tracking-[0.14em] text-faint uppercase hover:text-parchment">
        {open ? "Hide" : "Show"} {passages.length} passages consulted but not cited
      </button>
      {open && (
        <ol className="mt-3 divide-y divide-line border-y border-line">
          {passages.map((p) => (
            <SourceRow key={p.id} p={p} />
          ))}
        </ol>
      )}
    </div>
  );
}
