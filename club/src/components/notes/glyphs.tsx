import type { MarkKind } from "@/lib/data/types";
import { Manicule } from "@/components/ornaments";

export const MARK_NAMES: Record<MarkKind, string> = {
  manicule: "this one (a favourite)",
  nb: "nota bene",
  bang: "!",
  query: "?",
  heart: "♡",
};

/** The marks one leaves beside a note, drawn the way they'd be pencilled. */
export function MarkGlyph({ kind, className = "" }: { kind: MarkKind; className?: string }) {
  switch (kind) {
    case "manicule":
      return <Manicule width={22} height={11} className={className} />;
    case "nb":
      return <span className={`font-display-sc text-[0.95rem] leading-none tracking-wide ${className}`} style={{ fontFamily: "var(--font-display-sc)" }}>NB</span>;
    case "bang":
      return <span className={`font-display text-lg leading-none ${className}`}>!</span>;
    case "query":
      return <span className={`font-display text-lg leading-none ${className}`}>?</span>;
    case "heart":
      return (
        <svg viewBox="0 0 20 18" width={14} height={13} aria-hidden className={className}>
          <path d="M10 16.5 C 4 12.2, 1.2 9, 1.6 5.6 C 2 2.6, 5.2 1.2, 7.6 2.6 C 8.8 3.3, 9.5 4.3, 10 5.4 C 10.6 4.1, 11.5 3, 12.9 2.4 C 15.5 1.3, 18.4 3.1, 18.4 6 C 18.4 9.4, 15.4 12.4, 10 16.5 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
  }
}
