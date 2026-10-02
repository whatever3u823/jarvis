"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { MemberKey } from "@/club.config";
import { club } from "@/club.config";
import { updateProgress } from "@/lib/actions/reading";
import { IDLE } from "@/lib/actions/state";
import { chapterLabel, roman } from "@/lib/chapters";

interface Props {
  bookId: number;
  reader: MemberKey;
  totalChapters: number | null;
  totalPages: number | null;
  chapter: number;
  page: number | null;
  finished: boolean;
}

/** Move your ribbon: a chapter stepper, an optional page, and the last page. */
export function BookmarkForm({ bookId, reader, totalChapters, totalPages, chapter: initialChapter, page, finished: initiallyFinished }: Props) {
  const [state, action, pending] = useActionState(updateProgress, IDLE);
  const [chapter, setChapter] = useState(initialChapter);
  const [finished, setFinished] = useState(initiallyFinished);
  const [said, setSaid] = useState<string | null>(null);
  const lastStamp = useRef(state.stamp);
  const max = totalChapters ?? 999;

  useEffect(() => {
    if (state.ok && state.stamp !== lastStamp.current) {
      lastStamp.current = state.stamp;
      setSaid(state.values?.said ?? "Noted.");
      const t = setTimeout(() => setSaid(null), 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const step = (d: number) => {
    setFinished(false);
    setChapter((c) => Math.min(max, Math.max(0, c + d)));
  };

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="book_id" value={bookId} />
      <input type="hidden" name="chapter" value={chapter} />

      <div className={`flex items-center gap-3 transition-opacity ${finished ? "opacity-40" : ""}`}>
        <span className="label w-16">Chapter</span>
        <button type="button" onClick={() => step(-1)} disabled={chapter <= 0} className="h-9 w-9 border border-ink/40 font-display text-xl leading-none hover:bg-ink hover:text-paper disabled:opacity-30" aria-label="Back one chapter">
          −
        </button>
        <output className="min-w-[5.5rem] text-center font-display text-3xl leading-none" aria-live="polite">
          {chapter === 0 ? <span className="text-xl italic text-ink-faint">not begun</span> : roman(chapter)}
          <span className="sr-only">{chapter === 0 ? "" : chapterLabel(chapter)}</span>
        </output>
        <button type="button" onClick={() => step(1)} disabled={chapter >= max} className="h-9 w-9 border border-ink/40 font-display text-xl leading-none hover:bg-ink hover:text-paper disabled:opacity-30" aria-label="Forward one chapter">
          +
        </button>
        {totalChapters ? <span className="text-sm italic text-ink-faint">of {roman(totalChapters)}</span> : null}
      </div>

      <label className={`flex items-baseline gap-3 transition-opacity ${finished ? "opacity-40" : ""}`}>
        <span className="label w-16">Page</span>
        <input
          key={page ?? "none"}
          name="page"
          defaultValue={page ?? ""}
          inputMode="numeric"
          pattern="[0-9]*"
          className="field !w-24 text-center"
          placeholder="—"
          aria-describedby={`pages-${bookId}`}
        />
        <span id={`pages-${bookId}`} className="text-sm italic text-ink-faint">
          {totalPages ? `of ${totalPages}, if you know it` : "if you know it"}
        </span>
      </label>

      <label className="flex cursor-pointer items-center gap-3">
        <span className="w-16" />
        <input type="checkbox" name="finished" checked={finished} onChange={(e) => setFinished(e.target.checked)} className="h-4 w-4 accent-[var(--wax)]" />
        <span className="text-[1.05rem]">I’ve read the last page</span>
      </label>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <button className="btn btn-solid" disabled={pending}>
          {pending ? "Moving…" : "Move my ribbon"}
        </button>
        <span role="status" aria-live="polite" className="text-[1.05rem]" style={said ? { fontFamily: club.members[reader].hand, color: `var(--${reader})` } : undefined}>
          {state.error ? <span className="italic text-wax">{state.error}</span> : said}
        </span>
      </div>
    </form>
  );
}
