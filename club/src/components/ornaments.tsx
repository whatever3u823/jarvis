import type { SVGProps } from "react";
import { Cat, Monkey } from "./creatures";
import { club } from "@/club.config";

type P = SVGProps<SVGSVGElement>;

/** The printer's pointing hand, ☞: "this one". */
export function Manicule(props: P) {
  return (
    <svg viewBox="0 0 44 20" fill="currentColor" aria-hidden {...props}>
      <path d="M1 5.5 h6 v9 h-6z" />
      <path d="M2.5 7.5 h3 M2.5 10 h3 M2.5 12.5 h3" stroke="var(--paper)" strokeWidth=".7" />
      <path d="M8 6 C 10 3.6, 14 3.4, 17 4.6 L 39 6.2 C 42.4 6.5, 42.4 10.4, 39 10.6 L 21 11 C 21.6 12.2, 21.2 13.6, 19.8 13.9 C 20.3 15.2, 19.6 16.4, 18.2 16.6 C 18.4 17.8, 17.4 18.8, 16 18.6 L 11 18.4 C 9 18.2, 8 17, 8 15.4 Z" />
      <path d="M21 11 L 15 11.3 M19.8 13.9 L 14.6 14 M18.2 16.6 L 14 16.6" stroke="var(--paper)" strokeWidth=".7" fill="none" />
    </svg>
  );
}

/** An asterism, ⁂: three small stars, the typesetter's pause. */
export function Fleuron(props: P) {
  const star = "M0 -5 C 0.6 -1.2, 1.2 -0.6, 5 0 C 1.2 0.6, 0.6 1.2, 0 5 C -0.6 1.2, -1.2 0.6, -5 0 C -1.2 -0.6, -0.6 -1.2, 0 -5 Z";
  return (
    <svg viewBox="0 0 40 24" fill="currentColor" aria-hidden {...props}>
      <path d={star} transform="translate(20 7)" />
      <path d={star} transform="translate(13 17) scale(.9)" />
      <path d={star} transform="translate(27 17) scale(.9)" />
    </svg>
  );
}

/**
 * Arevakhach, the Armenian wheel of eternity, as a small closing mark.
 * Six arms turning the same way.
 */
export function Eternity(props: P) {
  const arm = "M20 20 C 20 13, 24 8, 30 8 C 27 11, 26 15, 27.5 19 C 25 17.5, 22 18, 20 20 Z";
  return (
    <svg viewBox="0 0 40 40" fill="currentColor" aria-hidden {...props}>
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <path key={deg} d={arm} transform={`rotate(${deg} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="2" fill="var(--paper)" />
    </svg>
  );
}

/** A Sicilian lemon, for the monkey's ratings. */
export function Lemon({ filled = true, ...props }: P & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        d="M3.5 13.5 C 3 11, 5 7.5, 9.5 6.5 C 13 5.7, 17.5 6.5, 19.5 9.5 C 21 11.5, 21.5 13, 20.8 14 C 19.5 17, 15 18.6, 11 18 C 7.5 17.5, 4.6 16, 3.5 13.5 Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M3.5 13.5 L 2 14.2 M20.8 14 L 22.2 13.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M14 6.4 C 14.5 4.5, 16.5 3, 19 3.4 C 18 5.2, 16.4 6.3, 14 6.4 Z" fill={filled ? "var(--sage)" : "none"} stroke="var(--sage)" strokeWidth="1" />
    </svg>
  );
}

/** An Armenian pomegranate, for the cat's ratings. */
export function Pomegranate({ filled = true, ...props }: P & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        d="M9.5 5.5 L 9 2.8 L 10.8 4 L 12 2.2 L 13.2 4 L 15 2.8 L 14.5 5.5 C 18.5 6.6, 21 9.8, 21 13.4 C 21 18, 17 21.5, 12 21.5 C 7 21.5, 3 18, 3 13.4 C 3 9.8, 5.5 6.6, 9.5 5.5 Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {filled ? <path d="M8 12 q1 -2.5 3 -3" stroke="var(--paper)" strokeWidth="1" fill="none" strokeLinecap="round" opacity=".6" /> : null}
    </svg>
  );
}

/** A wax seal with the society's two heads pressed into it. */
export function WaxSeal(props: P) {
  const edge =
    "M50 4 C 58 3, 62 8, 69 8 C 77 9, 80 15, 86 19 C 93 25, 92 31, 95 38 C 98 46, 95 52, 96 59 C 96 67, 90 71, 87 78 C 83 86, 76 87, 70 92 C 63 96, 56 94, 49 96 C 41 97, 36 92, 29 90 C 21 87, 18 81, 13 76 C 7 69, 8 63, 5 56 C 3 48, 6 42, 6 35 C 7 27, 12 23, 16 17 C 21 10, 28 10, 34 7 C 40 4, 44 5, 50 4 Z";
  return (
    <svg viewBox="0 0 100 100" aria-hidden {...props}>
      <defs>
        <radialGradient id="wax-sheen" cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="var(--wax-light)" />
          <stop offset="1" stopColor="var(--wax)" />
        </radialGradient>
      </defs>
      <path d={edge} fill="url(#wax-sheen)" />
      <g>
          <circle cx="50" cy="50" r="30" fill="none" stroke="rgb(0 0 0 / .25)" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="27" fill="none" stroke="rgb(255 255 255 / .12)" strokeWidth="1" />
          <g fill="rgb(0 0 0 / .32)">
            <svg x="25" y="35" width="24" height="24" viewBox="0 0 40 40" overflow="visible">
              <circle cx="7" cy="21" r="6" />
              <circle cx="33" cy="21" r="6" />
              <circle cx="20" cy="21" r="13" />
            </svg>
            <svg x="51" y="33" width="24" height="24" viewBox="0 0 40 40" overflow="visible">
              <path d="M8 18 L7 3 L17 11 Z" />
              <path d="M23 11 L33 3 L32 18 Z" />
              <ellipse cx="20" cy="23" rx="14" ry="12" />
            </svg>
          </g>
          <path d="M30 68 Q50 76 70 68" fill="none" stroke="rgb(0 0 0 / .25)" strokeWidth="1.4" />
      </g>
    </svg>
  );
}

/** A section rule with something small sitting on it. */
export function OrnamentRule({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-4 text-rule ${className}`} aria-hidden>
      <div className="rule flex-1" />
      <div className="text-ink-faint">{children ?? <Fleuron width={26} height={16} />}</div>
      <div className="rule flex-1" />
    </div>
  );
}

/** Ex libris: the monkey and the cat on either side of the motto. */
export function Bookplate({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`relative border border-ink/70 p-1.5 ${className}`}>
      <div className="border border-ink/40 px-6 pt-5 pb-4 text-center">
        <div className="label tracking-[0.3em] text-ink-soft">Ex Libris</div>
        <div className="mt-3 flex items-end justify-center gap-3">
          <Monkey pose="read" width={compact ? 54 : 74} className="text-monkey" />
          <div className="mb-3 font-display text-3xl italic text-ink-soft">&amp;</div>
          <Cat pose="sit" width={compact ? 50 : 68} className="-scale-x-100 text-cat" />
        </div>
        <div className="mx-auto mt-3 h-px w-2/3 bg-rule" />
        <div className="mt-2 font-display text-lg italic leading-tight" title={club.mottoGloss}>
          {club.motto}
        </div>
      </div>
    </div>
  );
}
