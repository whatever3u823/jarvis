"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DocumentRecord } from "@/lib/documents";
import { formatBytes, formatDate, formatNumber, STATUS_LABEL } from "@/lib/shared/format";
import { BookCover } from "../library/BookCover";

/** The left column of a volume: cover, bibliographic details, status and actions. */
export function BookDetails({ initial }: { initial: DocumentRecord }) {
  const router = useRouter();
  const [doc, setDoc] = useState(initial);
  const [editing, setEditing] = useState(false);

  useEffect(() => setDoc(initial), [initial]);

  // Follow indexing progress live.
  const working = doc.status === "queued" || doc.status === "processing";
  useEffect(() => {
    if (!working) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/documents/${doc.id}`);
      if (!r.ok) return;
      const j = await r.json();
      setDoc(j.document);
      if (j.document.status !== "queued" && j.document.status !== "processing") router.refresh();
    }, 1500);
    return () => clearInterval(t);
  }, [working, doc.id, router]);

  const reprocess = async () => {
    await fetch(`/api/documents/${doc.id}/reprocess`, { method: "POST" });
    setDoc({ ...doc, status: "queued", stage: "queued", progress: 0, statusDetail: null });
  };

  const remove = async () => {
    if (!window.confirm(`Remove “${doc.title}” from the library? The PDF and its index will be deleted.`)) return;
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  return (
    <div>
      <div className="mx-auto aspect-[2/3] w-full max-w-[200px] overflow-hidden lg:max-w-[280px] border border-line-strong bg-panel shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
        <BookCover doc={doc} size="lg" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 font-mono text-[11px] tracking-[0.12em] uppercase">
        <Link
          href={`/books/${doc.id}/read`}
          className="col-span-2 border border-brass-dim bg-brass/5 py-2.5 text-center text-brass transition-colors hover:bg-brass/10 hover:text-brass-bright"
        >
          Open reader
        </Link>
        <a href={`/api/documents/${doc.id}/file?download`} className="border border-line py-2 text-center text-muted transition-colors hover:border-line-strong hover:text-parchment">
          Download
        </a>
        <button onClick={() => setEditing((v) => !v)} className="border border-line py-2 text-muted transition-colors hover:border-line-strong hover:text-parchment">
          {editing ? "Cancel" : "Edit details"}
        </button>
      </div>

      {editing && (
        <EditForm
          doc={doc}
          onSaved={(d) => {
            setDoc(d);
            setEditing(false);
            router.refresh();
          }}
        />
      )}

      <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-t border-line pt-5 font-mono text-[11px]">
        <Meta k="Status">
          <span className={doc.status === "ready" ? "text-sage" : doc.status === "failed" ? "text-rust" : "text-brass"}>{STATUS_LABEL[doc.status]}</span>
          {working && ` · ${Math.round(doc.progress * 100)}%`}
        </Meta>
        <Meta k="Pages">{doc.pageCount ?? "—"}</Meta>
        {doc.textPages != null && doc.pageCount != null && doc.textPages !== doc.pageCount && <Meta k="With text">{doc.textPages}</Meta>}
        <Meta k="Passages">{doc.chunkCount != null ? formatNumber(doc.chunkCount) : "—"}</Meta>
        <Meta k="Chapters">{doc.outline.length || "—"}</Meta>
        <Meta k="File">
          {doc.fileType.toUpperCase()} · {formatBytes(doc.fileSize)}
        </Meta>
        <Meta k="Added">{formatDate(doc.createdAt)}</Meta>
        {doc.processedAt && <Meta k="Indexed">{formatDate(doc.processedAt)}</Meta>}
      </dl>
      <div className="mt-2 truncate font-mono text-[10px] text-faint" title={doc.fileName}>
        {doc.fileName}
      </div>

      <div className="mt-6 flex gap-4 font-mono text-[10.5px] tracking-[0.12em] uppercase">
        <button onClick={reprocess} disabled={working} className="text-faint hover:text-parchment disabled:opacity-40">
          Re-index
        </button>
        <button onClick={remove} className="text-faint hover:text-rust">
          Remove
        </button>
      </div>
    </div>
  );
}

function Meta({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="tracking-[0.12em] text-faint uppercase">{k}</dt>
      <dd className="text-parchment">{children}</dd>
    </>
  );
}

function EditForm({ doc, onSaved }: { doc: DocumentRecord; onSaved: (d: DocumentRecord) => void }) {
  const [title, setTitle] = useState(doc.title);
  const [author, setAuthor] = useState(doc.author ?? "");
  const [description, setDescription] = useState(doc.description ?? "");
  const [tags, setTags] = useState(doc.tags.join(", "));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const r = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        author: author || null,
        description: description || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    setSaving(false);
    if (r.ok) onSaved((await r.json()).document);
  };

  const field = "w-full rounded-sm border border-line bg-ink px-2.5 py-2 text-[13px] text-ivory outline-none focus:border-brass-dim";
  return (
    <form
      className="mt-5 animate-fade-in space-y-3 border border-line bg-panel p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="block">
        <span className="label mb-1 block">Title</span>
        <input className={`${field} font-serif text-[15px]`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block">
        <span className="label mb-1 block">Author</span>
        <input className={field} value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <label className="block">
        <span className="label mb-1 block">Description</span>
        <textarea className={`${field} font-serif text-[14px]`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="block">
        <span className="label mb-1 block">Tags, comma separated</span>
        <input className={`${field} font-mono text-[12px]`} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="stoicism, philosophy" />
      </label>
      <button
        type="submit"
        disabled={saving}
        className="w-full border border-brass-dim py-2 font-mono text-[11px] tracking-[0.14em] text-brass uppercase hover:text-brass-bright disabled:opacity-50"
      >
        {saving ? "Saving" : "Save"}
      </button>
      <p className="font-mono text-[10px] leading-relaxed text-faint">Title and author appear in citations. Re-indexing keeps your edits.</p>
    </form>
  );
}
