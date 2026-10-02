"use client";

import { useActionState, useEffect, useState } from "react";
import { setGoal } from "@/lib/actions/books";
import { IDLE } from "@/lib/actions/state";

export function GoalForm({ bookId, goalChapter, goalDate, totalChapters }: { bookId: number; goalChapter: number | null; goalDate: string | null; totalChapters: number | null }) {
  const [state, action, pending] = useActionState(setGoal, IDLE);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[0.95rem] italic text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink">
        {goalChapter ? "change the next stop" : "set a next stop"}
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-end gap-4">
      <input type="hidden" name="book_id" value={bookId} />
      <label>
        <span className="label block">Up to chapter</span>
        <input name="goal_chapter" type="number" min={1} max={totalChapters ?? 999} defaultValue={goalChapter ?? ""} className="field !w-20" />
      </label>
      <label>
        <span className="label block">By</span>
        <input name="goal_date" type="date" defaultValue={goalDate ?? ""} className="field !w-auto" />
      </label>
      <button className="btn !py-2" disabled={pending}>
        {pending ? "…" : "Agree on it"}
      </button>
      <button type="button" className="btn btn-quiet !py-2" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {state.error && <span className="text-sm italic text-wax">{state.error}</span>}
    </form>
  );
}
