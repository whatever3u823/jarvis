"use client";

import { useState, useTransition } from "react";
import { deleteBook, setStatus } from "@/lib/actions/books";
import type { Status } from "@/lib/data/types";

const LABELS: Record<Status, string> = { want: "On the pile", reading: "Reading", finished: "Finished", abandoned: "Set aside" };

export function StatusControl({ bookId, status }: { bookId: number; status: Status }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1" role="radiogroup" aria-label="Status">
      {(Object.keys(LABELS) as Status[]).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={s === status}
          disabled={pending}
          onClick={() => s !== status && start(() => setStatus(bookId, s))}
          className={`text-[0.98rem] transition-colors ${s === status ? "text-ink underline decoration-wax decoration-[1.5px] underline-offset-4" : "italic text-ink-faint hover:text-ink"}`}
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  );
}

export function DeleteBook({ bookId, title }: { bookId: number; title: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="text-sm italic text-ink-faint hover:text-wax">
        remove from the archive…
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="italic text-wax">Remove “{title}” and every note in its margins? This can’t be undone.</span>
      <button type="button" className="btn !border-wax !py-1 !text-[0.62rem] !text-wax hover:!bg-wax hover:!text-paper" disabled={pending} onClick={() => start(() => deleteBook(bookId))}>
        {pending ? "Removing…" : "Yes, remove it"}
      </button>
      <button type="button" className="btn btn-quiet !py-1 !text-[0.62rem]" onClick={() => setAsking(false)}>
        Keep it
      </button>
    </div>
  );
}
