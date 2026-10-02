"use client";

import { useActionState, useEffect, useState } from "react";
import { club, type MemberKey } from "@/club.config";
import { saveNotes } from "@/lib/actions/reading";
import { IDLE } from "@/lib/actions/state";
import { Head } from "@/components/creatures";

/** Each of us keeps a longer page of notes on the book. Only your own is editable. */
export function MemberNotes({ bookId, who, text, editable }: { bookId: number; who: MemberKey; text: string | null; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(saveNotes, IDLE);
  const m = club.members[who];
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Head who={who} size={20} />
        <span style={{ fontFamily: m.hand, color: `var(--${who})`, fontSize: who === "monkey" ? "1.4rem" : "1.02rem" }} className="leading-none">
          {m.name}’s page
        </span>
      </div>
      {editing ? (
        <form action={action} className="mt-3">
          <input type="hidden" name="book_id" value={bookId} />
          <textarea name="notes" defaultValue={text ?? ""} rows={7} className="field" autoFocus placeholder="Verdicts, grudges, favourite characters, what it reminded you of…" />
          <div className="mt-2 flex items-center gap-3">
            <button className="btn !py-1.5 !text-[0.65rem]" disabled={pending}>
              {pending ? "Inking…" : "Keep it"}
            </button>
            <button type="button" className="btn btn-quiet !py-1.5 !text-[0.65rem]" onClick={() => setEditing(false)}>
              Never mind
            </button>
            {state.error && <span className="text-sm italic text-wax">{state.error}</span>}
          </div>
        </form>
      ) : text ? (
        <div className="mt-3">
          <p className="text-[1.08rem] leading-relaxed whitespace-pre-line">{text}</p>
          {editable && (
            <button type="button" className="mt-2 text-sm italic text-ink-faint hover:text-ink" onClick={() => setEditing(true)}>
              amend
            </button>
          )}
        </div>
      ) : editable ? (
        <button type="button" onClick={() => setEditing(true)} className="mt-3 block w-full border border-dashed border-rule px-4 py-5 text-left italic text-ink-faint hover:border-ink-faint hover:text-ink-soft">
          Your page is blank. Write what you’d want to remember about this one.
        </button>
      ) : (
        <p className="mt-3 italic text-ink-faint">A blank page, for now.</p>
      )}
    </div>
  );
}
