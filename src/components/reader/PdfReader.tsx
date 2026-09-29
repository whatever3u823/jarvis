"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/types/src/display/api";
import { findHighlightRanges } from "./highlight";

export interface ReaderTarget {
  page: number;
  /** Highlight this chunk's text on the page. */
  chunkId?: number | null;
  /** Or highlight this literal text (e.g. a quotation). */
  text?: string | null;
  /** Changes on every navigation request, so re-opening the same target navigates again. */
  nonce?: number;
}

interface Props {
  documentId: string;
  target: ReaderTarget;
  pageCount?: number | null;
  /** Called when the user navigates, so a parent can mirror the page in the URL. */
  onPageChange?: (page: number) => void;
  compact?: boolean;
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsPromise;
}

const docCache = new Map<string, Promise<PDFDocumentProxy>>();
function openDocument(documentId: string): Promise<PDFDocumentProxy> {
  let p = docCache.get(documentId);
  if (!p) {
    p = loadPdfJs().then(
      (pdfjs) =>
        pdfjs.getDocument({
          url: `/api/documents/${documentId}/file`,
          rangeChunkSize: 256 * 1024,
          disableAutoFetch: true,
        }).promise,
    );
    p.catch(() => docCache.delete(documentId));
    docCache.set(documentId, p);
  }
  return p;
}

const highlightTextCache = new Map<number, Promise<string | null>>();
function chunkText(chunkId: number): Promise<string | null> {
  let p = highlightTextCache.get(chunkId);
  if (!p) {
    p = fetch(`/api/chunks/${chunkId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.chunk?.text ?? null)
      .catch(() => null);
    highlightTextCache.set(chunkId, p);
  }
  return p;
}

export function PdfReader({ documentId, target, pageCount, onPageChange, compact }: Props) {
  const [page, setPage] = useState(target.page);
  const [numPages, setNumPages] = useState<number | null>(pageCount ?? null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [night, setNight] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pageInput, setPageInput] = useState(String(target.page));

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<{ task: RenderTask | null; token: number }>({ task: null, token: 0 });
  const [width, setWidth] = useState(0);

  // Follow external navigation (e.g. clicking another citation).
  useEffect(() => {
    setPage(target.page);
  }, [target.page, target.chunkId, target.text, target.nonce]);

  useEffect(() => setPageInput(String(page)), [page]);

  useEffect(() => {
    try {
      setNight(localStorage.getItem("jarvis.reader.night") === "1");
    } catch {}
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const render = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage || width === 0) return;
    const token = ++renderRef.current.token;
    renderRef.current.task?.cancel();
    try {
      const [pdfjs, doc] = await Promise.all([loadPdfJs(), openDocument(documentId)]);
      if (token !== renderRef.current.token) return;
      setNumPages(doc.numPages);
      const n = Math.min(Math.max(1, page), doc.numPages);
      const pdfPage = await doc.getPage(n);
      if (token !== renderRef.current.token) return;

      const base = pdfPage.getViewport({ scale: 1 });
      const maxWidth = Math.min(width - (compact ? 24 : 48), compact ? 820 : 780);
      const scale = (maxWidth / base.width) * zoom;
      const viewport = pdfPage.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.style.display = "block";

      const task = pdfPage.render({
        canvas,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      renderRef.current.task = task;
      await task.promise;
      if (token !== renderRef.current.token) return;

      const textDiv = document.createElement("div");
      textDiv.className = "textLayer";
      textDiv.style.setProperty("--total-scale-factor", String(scale));
      const textLayer = new pdfjs.TextLayer({
        textContentSource: await pdfPage.getTextContent(),
        container: textDiv,
        viewport,
      });
      await textLayer.render();
      if (token !== renderRef.current.token) return;

      const pageBox = document.createElement("div");
      pageBox.style.position = "relative";
      pageBox.style.width = `${Math.floor(viewport.width)}px`;
      pageBox.style.height = `${Math.floor(viewport.height)}px`;
      pageBox.appendChild(canvas);
      pageBox.appendChild(textDiv);
      stage.replaceChildren(pageBox);
      setStatus("ready");

      // Highlight the cited passage (or quotation) on this page.
      const wanted = target.text ? target.text : target.chunkId ? await chunkText(target.chunkId) : null;
      if (wanted && token === renderRef.current.token && n >= target.page - 1 && n <= target.page + 3) {
        const spans = textLayer.textDivs as HTMLElement[];
        const marked = findHighlightRanges(
          spans.map((s) => s.textContent ?? ""),
          wanted,
        );
        let first: HTMLElement | null = null;
        for (const i of marked) {
          spans[i].classList.add("passage-hl");
          first ??= spans[i];
        }
        if (first && viewportRef.current) {
          const top = first.getBoundingClientRect().top - viewportRef.current.getBoundingClientRect().top;
          viewportRef.current.scrollTo({ top: viewportRef.current.scrollTop + top - 120, behavior: "smooth" });
        }
      }

      // Warm the next page.
      if (n < doc.numPages) void doc.getPage(n + 1);
    } catch (err) {
      if (err instanceof Error && err.name === "RenderingCancelledException") return;
      if (token !== renderRef.current.token) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [documentId, page, width, zoom, compact, target.chunkId, target.text, target.page]);

  useEffect(() => {
    void render();
  }, [render]);

  const go = useCallback(
    (p: number) => {
      const max = numPages ?? p;
      const next = Math.min(Math.max(1, p), max);
      setPage(next);
      onPageChange?.(next);
      viewportRef.current?.scrollTo({ top: 0 });
    },
    [numPages, onPageChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(page + 1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, page]);

  const toggleNight = () => {
    setNight((v) => {
      try {
        localStorage.setItem("jarvis.reader.night", v ? "0" : "1");
      } catch {}
      return !v;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <IconButton label="Previous page" onClick={() => go(page - 1)} disabled={page <= 1}>
            ‹
          </IconButton>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = parseInt(pageInput, 10);
              if (Number.isFinite(n)) go(n);
            }}
            className="flex items-center gap-1.5 font-mono text-[12px] text-muted"
          >
            <input
              aria-label="Page number"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ""))}
              className="w-12 rounded-sm border border-line bg-ink px-1.5 py-1 text-center text-ivory outline-none focus:border-brass-dim"
            />
            <span>/ {numPages ?? "—"}</span>
          </form>
          <IconButton label="Next page" onClick={() => go(page + 1)} disabled={numPages !== null && page >= numPages}>
            ›
          </IconButton>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
          <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}>
            −
          </IconButton>
          <button onClick={() => setZoom(1)} className="w-11 text-center hover:text-ivory" title="Fit width">
            {Math.round(zoom * 100)}%
          </button>
          <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}>
            +
          </IconButton>
          <span className="mx-1.5 h-4 w-px bg-line" />
          <button
            onClick={toggleNight}
            className={`rounded-sm px-2 py-1 tracking-wider uppercase transition-colors ${night ? "text-brass" : "hover:text-ivory"}`}
            title="Toggle night paper"
          >
            {night ? "Night" : "Paper"}
          </button>
        </div>
      </div>

      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-auto bg-[#0e0e0d]">
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="label animate-pulse-soft">Opening volume</span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-rust">
            Could not render this page. {error}
          </div>
        )}
        <div className={`flex justify-center ${compact ? "py-4" : "py-8"} ${night ? "page-night" : "page-paper"}`}>
          <div ref={stageRef} className="shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" />
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-sm border border-transparent text-lg leading-none text-parchment transition-colors hover:border-line hover:text-ivory disabled:opacity-30"
    >
      {children}
    </button>
  );
}
