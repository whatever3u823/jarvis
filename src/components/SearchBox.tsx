"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type SearchMode = "search" | "ask";

interface Props {
  variant?: "hero" | "bar" | "inline";
  initialQuery?: string;
  initialMode?: SearchMode;
  /** Restrict to one book: submits to the book page instead of global pages. */
  scope?: { documentId: string; title: string };
  /** Registers the global "/" and ⌘K shortcuts. */
  primary?: boolean;
  autoFocus?: boolean;
  /** Custom submit handler (e.g. on the book page); defaults to navigation. */
  onSubmit?: (query: string, mode: SearchMode) => void;
}

export function SearchBox({ variant = "bar", initialQuery = "", initialMode = "search", scope, primary, autoFocus, onSubmit }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => setMode(initialMode), [initialMode]);

  useEffect(() => {
    if (!primary) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primary]);

  const submit = (m: SearchMode) => {
    const q = query.trim();
    if (!q) return;
    if (onSubmit) return onSubmit(q, m);
    const enc = encodeURIComponent(q);
    if (scope) router.push(`/books/${scope.documentId}?mode=${m}&q=${enc}`);
    else router.push(m === "ask" ? `/ask?q=${enc}` : `/search?q=${enc}`);
  };

  const hero = variant === "hero";
  const placeholder = scope
    ? mode === "ask"
      ? `Ask ${scope.title.length > 40 ? "this volume" : `“${scope.title}”`} a question…`
      : "Search within this volume…"
    : mode === "ask"
      ? "Ask the library a question…"
      : hero
        ? "Search the library…"
        : "Search the library";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(mode);
      }}
      className={`group relative w-full ${hero ? "" : ""}`}
    >
      <div
        className={`flex items-center border bg-panel transition-colors focus-within:border-brass-dim ${
          hero ? "rounded-sm border-line-strong px-5 py-4" : "rounded-sm border-line px-3 py-1.5"
        }`}
      >
        <ModeToggle mode={mode} setMode={setMode} large={hero} />
        <span className={`mx-3 self-stretch w-px bg-line ${hero ? "my-1" : ""}`} />
        <input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              setMode("ask");
              submit("ask");
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          spellCheck={false}
          className={`min-w-0 flex-1 bg-transparent text-ivory outline-none placeholder:text-faint ${
            hero ? "font-display text-[26px] leading-tight md:text-[30px]" : "text-[14px]"
          }`}
        />
        {hero ? (
          <button
            type="submit"
            className="ml-4 hidden shrink-0 font-mono text-[11px] tracking-[0.14em] text-muted uppercase transition-colors group-focus-within:text-brass hover:text-brass-bright sm:block"
          >
            {mode === "ask" ? "Ask ↵" : "Search ↵"}
          </button>
        ) : (
          primary && (
            <kbd className="ml-2 hidden rounded-xs border border-line px-1.5 font-mono text-[10px] text-faint sm:block">/</kbd>
          )
        )}
      </div>
      {hero && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[10.5px] tracking-wide text-faint">
          <span>↵ {mode === "ask" ? "ask" : "search"}</span>
          <span>⌘↵ ask the library</span>
          <span>/ focus from anywhere</span>
        </div>
      )}
    </form>
  );
}

function ModeToggle({ mode, setMode, large }: { mode: SearchMode; setMode: (m: SearchMode) => void; large?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center gap-0.5 font-mono tracking-[0.12em] uppercase ${large ? "text-[11px]" : "text-[10px]"}`}>
      {(["search", "ask"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={`rounded-xs px-2 py-1 transition-colors ${mode === m ? "bg-raised text-brass" : "text-faint hover:text-parchment"}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
