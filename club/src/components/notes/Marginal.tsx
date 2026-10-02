"use client";

import { startTransition, useActionState, useEffect, useOptimistic, useRef, useState } from "react";
import { club, type MemberKey } from "@/club.config";
import { MARK_KINDS, type Mark, type MarkKind } from "@/lib/data/types";
import type { NoteData } from "@/lib/threads";
import { addThought, editThought, eraseThought, toggleMark } from "@/lib/actions/thoughts";
import { IDLE } from "@/lib/actions/state";
import { Head } from "@/components/creatures";
import { MarkGlyph, MARK_NAMES } from "./glyphs";

type Open = Extract<NoteData, { sealed: false }>;

const INK: Record<MemberKey, string> = { monkey: "text-monkey", cat: "text-cat" };

/**
 * One note in the margin. The monkey writes in the left margin, the cat in
 * the right (on wide screens), each in their own ink, the way two people
 * would annotate the same copy from either side.
 */
export function Marginal({ note, reader, sided = true }: { note: Open; reader: MemberKey; sided?: boolean }) {
  const right = sided && note.member === "cat";
  return (
    <article
      id={`note-${note.id}`}
      className={`group/note relative scroll-mt-24 animate-rise ${sided ? (right ? "md:ml-[12%]" : "md:mr-[12%]") : ""}`}
    >
      <div className={`flex gap-4 md:gap-6 ${right ? "md:flex-row-reverse" : ""}`}>
        <Gutter note={note} right={right} />
        <div className="min-w-0 flex-1">
          <NoteBody note={note} reader={reader} right={right} />
          {note.replies.length > 0 && (
            <div className="mt-4 space-y-4 border-l border-dashed border-rule pl-4 sm:pl-6">
              {note.replies.map((r) => (r.sealed ? null : <Reply key={r.id} note={r} reader={reader} />))}
            </div>
          )}
          <ReplyBox parent={note} reader={reader} />
        </div>
      </div>
    </article>
  );
}

function Gutter({ note, right }: { note: Open; right: boolean }) {
  const m = club.members[note.member];
  return (
    <div className={`hidden w-[4.5rem] shrink-0 flex-col pt-1 sm:flex ${right ? "items-end text-right" : "items-start"}`}>
      <Head who={note.member} size={26} />
      <div className="mt-1 leading-none" style={{ fontFamily: m.hand, color: `var(--${note.member})`, fontSize: note.member === "monkey" ? "1.35rem" : "1rem" }}>
        {m.name}
      </div>
      <time className="mt-1.5 text-[0.8rem] leading-tight italic text-ink-faint" title={note.stamp}>
        {note.when}
      </time>
    </div>
  );
}

function NoteBody({ note, reader, right }: { note: Open; reader: MemberKey; right: boolean }) {
  const m = club.members[note.member];
  const [editing, setEditing] = useState(false);
  return (
    <div
      className="relative py-1 pl-4"
      style={{ borderLeft: `2px solid var(--${note.member})` }}
    >
      {/* phone: who and when sit above the note */}
      <div className="mb-1.5 flex items-center gap-2 sm:hidden">
        <Head who={note.member} size={18} />
        <span className="leading-none" style={{ fontFamily: m.hand, color: `var(--${note.member})`, fontSize: note.member === "monkey" ? "1.2rem" : "0.9rem" }}>
          {m.name}
        </span>
        <time className="text-[0.8rem] italic text-ink-faint" title={note.stamp}>
          {note.when}
        </time>
      </div>
      {note.quote && (
        <blockquote className="mb-3 font-serif text-[1.08rem] leading-snug italic text-ink-soft">
          <span className="mr-1 font-display text-2xl leading-none text-ink-faint not-italic">“</span>
          {note.quote}
          <span className="font-display text-2xl leading-none text-ink-faint not-italic">”</span>
          {note.page ? <span className="typed ml-2 text-[0.7rem] not-italic text-ink-faint">p.&nbsp;{note.page}</span> : null}
        </blockquote>
      )}
      {editing ? (
        <EditBox note={note} onDone={() => setEditing(false)} />
      ) : (
        <p className="text-[1.12rem] leading-[1.55] whitespace-pre-line text-ink">{note.body}</p>
      )}
      {!note.quote && note.page ? <div className="typed mt-1 text-[0.7rem] text-ink-faint">p. {note.page}</div> : null}
      <div className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 ${right ? "" : ""}`}>
        <Marks noteId={note.id} marks={note.marks} reader={reader} />
        <Tools note={note} reader={reader} onEdit={() => setEditing(true)} />
      </div>
    </div>
  );
}

function Reply({ note, reader }: { note: Open; reader: MemberKey }) {
  const m = club.members[note.member];
  const [editing, setEditing] = useState(false);
  return (
    <div id={`note-${note.id}`} className="scroll-mt-24">
      <div className="flex items-center gap-2">
        <Head who={note.member} size={15} />
        <span className="leading-none" style={{ fontFamily: m.hand, color: `var(--${note.member})`, fontSize: note.member === "monkey" ? "1.15rem" : "0.85rem" }}>
          {m.name}
        </span>
        <time className="text-[0.78rem] italic text-ink-faint" title={note.stamp}>
          {note.when}
        </time>
      </div>
      {editing ? (
        <EditBox note={note} onDone={() => setEditing(false)} />
      ) : (
        <p className="mt-1 text-[1.02rem] leading-[1.5] whitespace-pre-line text-ink-soft">{note.body}</p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-4">
        <Marks noteId={note.id} marks={note.marks} reader={reader} />
        <Tools note={note} reader={reader} onEdit={() => setEditing(true)} canReply={false} />
      </div>
    </div>
  );
}

function Marks({ noteId, marks, reader }: { noteId: number; marks: Mark[]; reader: MemberKey }) {
  const [optimistic, flip] = useOptimistic(marks, (current: Mark[], kind: MarkKind) =>
    current.some((m) => m.mark === kind && m.member === reader)
      ? current.filter((m) => !(m.mark === kind && m.member === reader))
      : [...current, { member: reader, mark: kind }],
  );

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Marks">
      {MARK_KINDS.map((kind) => {
        const by = optimistic.filter((m) => m.mark === kind);
        const mine = by.some((m) => m.member === reader);
        const used = by.length > 0;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={mine}
            title={`${MARK_NAMES[kind]}${by.length ? ` — marked by ${by.map((b) => club.members[b.member].name).join(" & ")}` : ""}`}
            onClick={() =>
              startTransition(async () => {
                flip(kind);
                await toggleMark(noteId, kind);
              })
            }
            className={`relative flex h-7 min-w-7 items-center justify-center gap-0.5 px-1 transition-opacity ${
              used ? "opacity-100" : "opacity-30 hover:opacity-80 focus-visible:opacity-80 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/note:opacity-30 [@media(hover:hover)]:group-focus-within/note:opacity-30"
            }`}
          >
            <MarkGlyph kind={kind} className={used ? (by.length === 2 ? "text-wax" : INK[by[0].member]) : "text-ink-soft"} />
            <span className="sr-only">{MARK_NAMES[kind]}</span>
            {by.length > 0 && (
              <span className="-mr-1 flex -space-x-1" aria-hidden>
                {by.map((b) => (
                  <Head key={b.member} who={b.member} size={10} />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Tools({ note, reader, onEdit, canReply = true }: { note: Open; reader: MemberKey; onEdit: () => void; canReply?: boolean }) {
  const mine = note.member === reader;
  const [confirming, setConfirming] = useState(false);
  if (!mine && !canReply) return null;
  return (
    <div className="flex items-center gap-3 text-[0.82rem] italic text-ink-faint [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/note:opacity-100 [@media(hover:hover)]:group-focus-within/note:opacity-100 transition-opacity">
      {canReply && (
        <button type="button" className="hover:text-ink" onClick={() => document.getElementById(`reply-${note.id}`)?.focus()}>
          reply
        </button>
      )}
      {mine && (
        <>
          <button type="button" className="hover:text-ink" onClick={onEdit}>
            amend
          </button>
          {confirming ? (
            <span className="flex items-center gap-2 not-italic">
              <span className="italic">erase for good?</span>
              <button type="button" className="label !text-wax hover:underline" onClick={() => startTransition(() => eraseThought(note.id))}>
                yes
              </button>
              <button type="button" className="label hover:underline" onClick={() => setConfirming(false)}>
                no
              </button>
            </span>
          ) : (
            <button type="button" className="hover:text-wax" onClick={() => setConfirming(true)}>
              erase
            </button>
          )}
        </>
      )}
    </div>
  );
}

function EditBox({ note, onDone }: { note: Open; onDone: () => void }) {
  const [state, action, pending] = useActionState(editThought, IDLE);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="mt-1">
      <input type="hidden" name="id" value={note.id} />
      <textarea name="body" defaultValue={note.body} rows={Math.min(10, Math.max(3, note.body.split("\n").length + 1))} className="field text-[1.05rem]" autoFocus />
      <div className="mt-2 flex items-center gap-3">
        <button className="btn !py-1.5 !text-[0.65rem]" disabled={pending}>
          {pending ? "Inking…" : "Keep changes"}
        </button>
        <button type="button" className="btn btn-quiet !py-1.5 !text-[0.65rem]" onClick={onDone}>
          Never mind
        </button>
        {state.error && <span className="text-sm italic text-wax">{state.error}</span>}
      </div>
    </form>
  );
}

/** A one-line reply that grows when you start writing. */
function ReplyBox({ parent, reader }: { parent: Open; reader: MemberKey }) {
  const [state, action, pending] = useActionState(addThought, IDLE);
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const lastStamp = useRef(state.stamp);
  useEffect(() => {
    if (state.ok && state.stamp !== lastStamp.current) {
      lastStamp.current = state.stamp;
      setText("");
    }
  }, [state]);
  const active = text.length > 0;
  return (
    <form action={action} className="mt-3 pl-4 sm:pl-6">
      <input type="hidden" name="book_id" value={parent.book_id} />
      <input type="hidden" name="chapter" value={parent.chapter} />
      <input type="hidden" name="reply_to" value={parent.id} />
      <label className="flex items-start gap-2">
        <Head who={reader} size={14} className="mt-1.5 opacity-60" />
        <span className="sr-only">Reply</span>
        <textarea
          id={`reply-${parent.id}`}
          ref={ref}
          name="body"
          rows={active ? 3 : 1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={reader === parent.member ? "add a line…" : "answer in the margin…"}
          className="w-full resize-none border-0 border-b border-transparent bg-transparent py-1 text-[1rem] text-ink-soft italic outline-none placeholder:text-ink-faint/70 focus:border-rule focus:not-italic"
        />
      </label>
      {active && (
        <div className="mt-2 flex items-center gap-3 pl-6">
          <button className="btn !py-1.5 !text-[0.65rem]" disabled={pending}>
            {pending ? "Inking…" : "Reply"}
          </button>
          {state.error && <span className="text-sm italic text-wax">{state.error}</span>}
        </div>
      )}
    </form>
  );
}
