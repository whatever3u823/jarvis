"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { club, type MemberKey } from "@/club.config";
import { addThought } from "@/lib/actions/thoughts";
import { IDLE } from "@/lib/actions/state";
import { chapterLabel, sections } from "@/lib/chapters";
import { Head } from "@/components/creatures";

interface Props {
  bookId: number;
  reader: MemberKey;
  /** Fixed chapter (chapter page) … */
  chapter?: number;
  /** … or a choice, defaulting to where the reader is. */
  totalChapters?: number | null;
  defaultChapter?: number;
  /** Chapters beyond this are marked as ahead of the other reader (they'll be sealed for them). */
  otherHorizon?: number;
  compact?: boolean;
}

/** Writing in the margin. */
export function Composer({ bookId, reader, chapter, totalChapters = null, defaultChapter = 0, otherHorizon, compact = false }: Props) {
  const [state, action, pending] = useActionState(addThought, IDLE);
  const [quoting, setQuoting] = useState(false);
  const [section, setSection] = useState(chapter ?? defaultChapter);
  const formRef = useRef<HTMLFormElement>(null);
  const lastStamp = useRef(state.stamp);
  const me = club.members[reader];

  useEffect(() => {
    if (state.ok && state.stamp !== lastStamp.current) {
      lastStamp.current = state.stamp;
      formRef.current?.reset();
      setQuoting(false);
    }
  }, [state]);

  const ahead = otherHorizon != null && section > otherHorizon;
  const other = club.members[reader === "monkey" ? "cat" : "monkey"];

  return (
    <form ref={formRef} action={action} className="relative">
      <input type="hidden" name="book_id" value={bookId} />
      {chapter != null && <input type="hidden" name="chapter" value={chapter} />}

      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-2">
          <Head who={reader} size={20} />
          <span className="leading-none" style={{ fontFamily: me.hand, color: `var(--${reader})`, fontSize: reader === "monkey" ? "1.45rem" : "1.05rem" }}>
            {reader === "monkey" ? "the monkey writes…" : "the cat writes…"}
          </span>
        </div>
        {chapter == null && (
          <label className="flex items-baseline gap-2">
            <span className="label">in</span>
            <select
              name="chapter"
              value={section}
              onChange={(e) => setSection(Number(e.target.value))}
              className="field !w-auto !py-0.5 !text-base"
            >
              {sections(totalChapters).map((s) => (
                <option key={s} value={s}>
                  {chapterLabel(s)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {quoting && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_6rem]">
          <label className="block">
            <span className="label">A line from the book</span>
            <textarea name="quote" rows={2} className="field mt-1 italic" placeholder="copy it out exactly…" autoFocus />
          </label>
          <label className="block">
            <span className="label">Page</span>
            <input name="page" inputMode="numeric" pattern="[0-9]*" className="field mt-1" placeholder="—" />
          </label>
        </div>
      )}

      <label className="mt-3 block">
        <span className="sr-only">Your note</span>
        <textarea
          name="body"
          rows={compact ? 3 : 4}
          required
          className="field text-[1.1rem]"
          placeholder={PROMPTS[reader][(bookId + section) % PROMPTS[reader].length]}
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="submit" className="btn btn-solid" disabled={pending}>
          {pending ? "Inking…" : "Leave it in the margin"}
        </button>
        {!quoting && (
          <button type="button" className="text-[0.95rem] italic text-ink-soft hover:text-ink" onClick={() => setQuoting(true)}>
            + copy out a line
          </button>
        )}
        <span role="status" aria-live="polite" className="text-[0.95rem] italic">
          {state.error ? <span className="text-wax">{state.error}</span> : ahead ? (
            <span className="text-ink-faint">{other.name} isn’t this far yet; it stays sealed until {other.name} gets there.</span>
          ) : null}
        </span>
      </div>
    </form>
  );
}

const PROMPTS: Record<MemberKey, string[]> = {
  monkey: [
    "Something to say about this chapter?",
    "A theory, however unfounded…",
    "Which line made you stop?",
    "Confess: did you skim?",
  ],
  cat: [
    "Something to say about this chapter?",
    "Who is behaving badly, and why?",
    "Which line made you stop?",
    "A small verdict…",
  ],
};
