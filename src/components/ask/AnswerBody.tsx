"use client";

import { memo, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Passage } from "@/lib/rag/passages";
import { linkCitations, segmentAnswer } from "@/lib/shared/answer";
import { chapterLeaf, pageRange, shortTitle } from "@/lib/shared/format";
import { useReader } from "../reader/ReaderDrawer";

function CitationChip({ id, passage }: { id: string; passage?: Passage }) {
  const { open } = useReader();
  const [hover, setHover] = useState(false);
  if (!passage) {
    return (
      <span className="mx-0.5 font-mono text-[0.68em] text-rust" title="This citation does not match any retrieved passage.">
        [{id}?]
      </span>
    );
  }
  const label = `${shortTitle(passage.title, 26)}, ${pageRange(passage)}`;
  return (
    <span className="relative inline-block" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        onClick={() =>
          open({
            documentId: passage.documentId,
            title: passage.title,
            author: passage.author,
            chapter: passage.chapter,
            page: passage.pageStart,
            chunkId: passage.chunkId,
          })
        }
        className="mx-[0.15em] inline-flex translate-y-[-0.08em] items-center rounded-xs border border-brass-dim/60 px-[0.4em] py-[0.05em] align-baseline font-sans text-[0.66em] leading-snug tracking-wide whitespace-nowrap text-brass transition-colors hover:border-brass hover:bg-brass/10 hover:text-brass-bright"
      >
        {label}
      </button>
      {hover && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 block w-[340px] -translate-x-1/2 animate-fade-in border border-line-strong bg-raised p-3.5 text-left shadow-2xl">
          <span className="block font-serif text-[14px] leading-snug text-ivory">{passage.title}</span>
          <span className="mt-1 block font-mono text-[10px] tracking-wide text-muted uppercase">
            {[passage.author, chapterLeaf(passage.chapter), pageRange(passage)].filter(Boolean).join(" · ")}
          </span>
          <span className="mt-2 block font-serif text-[13.5px] leading-relaxed text-parchment" style={{ display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {passage.text}
          </span>
          <span className="mt-2 block font-mono text-[9.5px] tracking-[0.14em] text-brass uppercase">Click to open the page</span>
        </span>
      )}
    </span>
  );
}

const Markdown = memo(function Markdown({ body, byId }: { body: string; byId: Map<string, Passage> }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url) => (url.startsWith("cite:") ? url : /^(https?:|mailto:|\/|#)/.test(url) ? url : "")}
      components={{
        a({ href, children }) {
          if (href?.startsWith("cite:")) {
            const id = href.slice(5);
            return <CitationChip id={id} passage={byId.get(id)} />;
          }
          return (
            <a href={href} className="text-brass underline decoration-brass-dim underline-offset-2" target="_blank" rel="noreferrer">
              {children}
            </a>
          );
        },
      }}
    >
      {linkCitations(body)}
    </ReactMarkdown>
  );
});

export function AnswerBody({ text, passages, streaming }: { text: string; passages: Passage[]; streaming?: boolean }) {
  const byId = useMemo(() => new Map(passages.map((p) => [p.id, p])), [passages]);
  const segments = useMemo(() => segmentAnswer(text), [text]);
  return (
    <div className="prose-answer">
      {segments.map((s, i) =>
        s.kind === "text" ? (
          <Markdown key={i} body={s.body} byId={byId} />
        ) : (
          <aside
            key={i}
            className={`my-5 border-l py-0.5 pl-5 ${s.kind === "synthesis" ? "border-brass-dim" : "border-dashed border-faint"}`}
          >
            <div className={`mb-2 font-mono text-[10px] tracking-[0.16em] uppercase ${s.kind === "synthesis" ? "text-brass-dim" : "text-faint"}`}>
              {s.kind === "synthesis" ? "Synthesis · interpretation beyond the text" : "Outside the library · general knowledge"}
            </div>
            <div className="text-parchment">
              <Markdown body={s.body} byId={byId} />
            </div>
          </aside>
        ),
      )}
      {streaming && <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] animate-pulse-soft bg-brass" />}
    </div>
  );
}
