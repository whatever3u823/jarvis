"use client";

import { useActionState, useState } from "react";
import { saveBook } from "@/lib/actions/books";
import { IDLE } from "@/lib/actions/state";
import type { Book, Status } from "@/lib/data/types";
import { Cover } from "./Cover";

const STATUS_LABELS: [Status, string, string][] = [
  ["want", "On the pile", "for later"],
  ["reading", "Reading", "open now"],
  ["finished", "Finished", "already read"],
  ["abandoned", "Set aside", "gave up"],
];

/** The accession card: what the archive knows about a book. */
export function BookForm({ book, coverPreview }: { book?: Book; coverPreview?: string | null }) {
  const [state, action, pending] = useActionState(saveBook, IDLE);
  const v = (k: keyof Book) => state.values?.[k] ?? (book?.[k] != null ? String(book[k]) : "");
  const [title, setTitle] = useState(v("title"));
  const [author, setAuthor] = useState(v("author"));
  const [status, setStatus] = useState<Status>((v("status") as Status) || "want");
  const [preview, setPreview] = useState<string | null>(coverPreview ?? null);
  const err = (k: string) => state.errors?.[k];

  return (
    <form action={action} className="grid gap-x-14 gap-y-10 md:grid-cols-[minmax(0,1fr)_14rem]" noValidate>
      {book && <input type="hidden" name="id" value={book.id} />}
      <div className="space-y-7">
        <Field label="Title" error={err("title")}>
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="field !font-display !text-3xl" placeholder="The Name of the Rose" autoFocus={!book} />
        </Field>
        <div className="grid gap-7 sm:grid-cols-2">
          <Field label="Author" error={err("author")}>
            <input name="author" value={author} onChange={(e) => setAuthor(e.target.value)} required className="field" placeholder="Umberto Eco" />
          </Field>
          <Field label="Translated by" hint="optional" error={err("translator")}>
            <input name="translator" defaultValue={v("translator")} className="field" placeholder="William Weaver" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <Field label="Pages" error={err("total_pages")}>
            <input name="total_pages" defaultValue={v("total_pages")} inputMode="numeric" className="field" placeholder="512" />
          </Field>
          <Field label="Chapters" error={err("total_chapters")}>
            <input name="total_chapters" defaultValue={v("total_chapters")} inputMode="numeric" className="field" placeholder="7" />
          </Field>
          <Field label="Year" error={err("year_published")}>
            <input name="year_published" defaultValue={v("year_published")} inputMode="numeric" className="field" placeholder="1980" />
          </Field>
        </div>
        <p className="-mt-3 text-sm italic text-ink-faint">Chapters are what the spoiler seals are built on; worth getting right.</p>

        <Field label="What it’s about" hint="a few lines, no spoilers" error={err("description")}>
          <textarea name="description" defaultValue={v("description")} rows={4} className="field" />
        </Field>

        <fieldset>
          <legend className="label">Where it stands</legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATUS_LABELS.map(([s, label, gloss]) => (
              <label key={s} className={`cursor-pointer border px-3 py-2.5 transition-colors ${status === s ? "border-ink bg-ink/5" : "border-rule hover:border-ink-faint"}`}>
                <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />
                <span className="block font-display text-lg leading-tight">{label}</span>
                <span className="block text-sm italic text-ink-faint">{gloss}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {status !== "want" && (
          <div className="grid gap-7 sm:grid-cols-2">
            <Field label="Begun" hint="defaults to today" error={err("started_on")}>
              <input type="date" name="started_on" defaultValue={v("started_on")} className="field" />
            </Field>
            {(status === "finished" || status === "abandoned") && (
              <Field label={status === "finished" ? "Finished" : "Set aside"} error={err("finished_on")}>
                <input type="date" name="finished_on" defaultValue={v("finished_on")} className="field" />
              </Field>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-5 border-t border-rule pt-6">
          <button className="btn btn-solid" disabled={pending}>
            {pending ? "Filing…" : book ? "Amend the record" : "Accession it"}
          </button>
          <span role="status" aria-live="polite" className="italic text-wax">
            {state.error}
          </span>
        </div>
      </div>

      <aside className="space-y-6 md:pt-2">
        <Cover title={title || "Untitled"} author={author || "Anonymous"} src={preview} size="lg" className="mx-auto md:!w-full" tilt={1} />
        <Field label="Cover image" hint="upload…" error={err("cover_file")}>
          <input
            type="file"
            name="cover_file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="mt-1 block w-full text-sm file:mr-3 file:border file:border-ink/40 file:bg-transparent file:px-3 file:py-1.5 file:font-sans file:text-xs file:uppercase file:tracking-widest"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPreview(URL.createObjectURL(f));
            }}
          />
        </Field>
        <Field label="…or a link to one" error={err("cover_url")}>
          <input name="cover_url" defaultValue={v("cover_url")} className="field !text-base" placeholder="https://…" onBlur={(e) => e.target.value && setPreview(e.target.value)} />
        </Field>
        <Field label="ISBN" hint="finds a cover by itself" error={err("isbn")}>
          <input name="isbn" defaultValue={v("isbn")} className="field !text-base" placeholder="978…" />
        </Field>
        {book?.cover_version && (
          <label className="flex items-center gap-2 text-sm italic text-ink-soft">
            <input type="checkbox" name="remove_cover" className="accent-[var(--wax)]" /> remove the uploaded cover
          </label>
        )}
        <p className="text-sm italic text-ink-faint">No cover? It gets bound in cloth instead, which is arguably nicer.</p>
      </aside>
    </form>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {hint && <span className="ml-2 font-serif text-[0.85rem] tracking-normal normal-case italic">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-sm italic text-wax">{error}</span>}
    </label>
  );
}
