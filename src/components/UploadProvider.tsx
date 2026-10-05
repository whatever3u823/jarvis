"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface UploadItem {
  key: string;
  name: string;
  size: number;
  progress: number;
  state: "waiting" | "uploading" | "done" | "duplicate" | "error";
  message?: string;
  documentId?: string;
}

const UploadContext = createContext<{ pickFiles: () => void } | null>(null);

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used inside <UploadProvider>");
  return ctx;
}

export const LIBRARY_CHANGED = "jarvis:library-changed";

type UploadResult = { status: number; body: any };

/** Local mode: multipart POST to the app. */
function uploadMultipart(file: File, onProgress: (p: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error("Network error"));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** Hosted mode: upload straight to Vercel Blob, then register it with the app. */
async function uploadToBlob(file: File, onProgress: (p: number) => void): Promise<UploadResult> {
  const { upload } = await import("@vercel/blob/client");
  const uploadId = crypto.randomUUID();
  await upload(`incoming/${uploadId}.pdf`, file, {
    access: "private",
    handleUploadUrl: "/api/uploads",
    contentType: "application/pdf",
    multipart: file.size > 8 * 1024 * 1024,
    onUploadProgress: (e) => onProgress(Math.min(0.99, e.percentage / 100)),
  });
  const res = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ uploadId, fileName: file.name }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Drag a PDF anywhere onto the window to add it to the library. */
export function UploadProvider({ children, mode = "multipart" }: { children: React.ReactNode; mode?: "multipart" | "blob" }) {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const dragDepth = useRef(0);

  const update = (key: string, patch: Partial<UploadItem>) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const addFiles = useCallback(
    (files: File[]) => {
      const pdfs = files.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
      const rejected = files.filter((f) => !pdfs.includes(f));
      const now = Date.now();
      const newItems: UploadItem[] = [
        ...pdfs.map((f, i) => ({ key: `${now}-${i}-${f.name}`, name: f.name, size: f.size, progress: 0, state: "waiting" as const })),
        ...rejected.map((f, i) => ({
          key: `${now}-r${i}-${f.name}`,
          name: f.name,
          size: f.size,
          progress: 0,
          state: "error" as const,
          message: "Only PDF files can be added for now.",
        })),
      ];
      setItems((xs) => [...xs.filter((x) => x.state === "waiting" || x.state === "uploading"), ...newItems]);
      pdfs.forEach((file, i) => {
        const key = newItems[i].key;
        queue.current = queue.current.then(async () => {
          update(key, { state: "uploading" });
          try {
            const send = mode === "blob" ? uploadToBlob : uploadMultipart;
            const { status, body } = await send(file, (p) => update(key, { progress: p }));
            if (status === 201) update(key, { state: "done", progress: 1, documentId: body.document.id });
            else if (status === 200 && body?.duplicate)
              update(key, { state: "duplicate", progress: 1, documentId: body.document.id, message: `Already in the library as “${body.document.title}”.` });
            else update(key, { state: "error", message: body?.error ?? `Upload failed (${status}).` });
          } catch (err) {
            update(key, { state: "error", message: err instanceof Error ? err.message : "Upload failed." });
          }
          window.dispatchEvent(new Event(LIBRARY_CHANGED));
          router.refresh();
        });
      });
    },
    [router, mode],
  );

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current++;
      setDragging(true);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      addFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [addFiles]);

  // Finished uploads fade from the tray after a while; errors stay until dismissed.
  useEffect(() => {
    if (!items.some((x) => x.state === "done" || x.state === "duplicate")) return;
    const t = setTimeout(() => setItems((xs) => xs.filter((x) => x.state !== "done" && x.state !== "duplicate")), 9000);
    return () => clearTimeout(t);
  }, [items]);

  const pickFiles = useCallback(() => inputRef.current?.click(), []);

  return (
    <UploadContext.Provider value={{ pickFiles }}>
      {children}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-ink/85 backdrop-blur-[2px]">
          <div className="border border-dashed border-brass-dim px-16 py-14 text-center">
            <div className="label mb-3 text-brass">Acquisition</div>
            <div className="font-display text-4xl text-ivory">Release to add to the library</div>
            <div className="mt-3 font-mono text-[11px] text-muted">PDF · text is extracted, indexed and made searchable</div>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="fixed right-5 bottom-5 z-40 w-[340px] animate-rise border border-line-strong bg-panel shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="label">Acquisitions</span>
            <button className="font-mono text-[11px] text-muted hover:text-ivory" onClick={() => setItems((xs) => xs.filter((x) => x.state === "uploading" || x.state === "waiting"))}>
              Dismiss
            </button>
          </div>
          <ul className="max-h-72 overflow-auto">
            {items.map((x) => (
              <li key={x.key} className="border-b border-line px-4 py-3 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-serif text-[15px] text-ivory" title={x.name}>
                    {x.name.replace(/\.pdf$/i, "")}
                  </span>
                  <span
                    className={`shrink-0 font-mono text-[10px] tracking-wider uppercase ${
                      x.state === "error" ? "text-rust" : x.state === "done" ? "text-sage" : "text-muted"
                    }`}
                  >
                    {x.state === "uploading" ? `${Math.round(x.progress * 100)}%` : x.state === "done" ? "Queued" : x.state}
                  </span>
                </div>
                {(x.state === "uploading" || x.state === "waiting") && (
                  <div className="mt-2 h-px w-full bg-line">
                    <div className="h-px bg-brass transition-[width]" style={{ width: `${x.progress * 100}%` }} />
                  </div>
                )}
                {x.message && <p className="mt-1 text-[12px] text-muted">{x.message}</p>}
                {x.documentId && (
                  <Link href={`/books/${x.documentId}`} className="mt-1 inline-block font-mono text-[10.5px] tracking-wide text-brass uppercase hover:text-brass-bright">
                    Open volume →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </UploadContext.Provider>
  );
}
