import type { CSSProperties, SVGProps } from "react";
import type { MemberKey } from "@/club.config";

/**
 * The two recurring characters, drawn as cut-paper silhouettes in the
 * manner of an old illustrated book. Cut-outs (eyes, faces, pages) are
 * filled with the paper colour, so they read correctly by day and by night.
 */

type Base = Omit<SVGProps<SVGSVGElement>, "children"> & { title?: string };

const CUT = "var(--paper)";

function Svg({ title, viewBox, children, ...rest }: Base & { viewBox: string; children: React.ReactNode }) {
  return (
    <svg viewBox={viewBox} fill="currentColor" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} {...rest}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export type CatPose = "sit" | "loaf" | "walk" | "peek";
export type MonkeyPose = "read" | "hang" | "head";

export function Cat({ pose = "sit", ...rest }: Base & { pose?: CatPose | "head" }) {
  switch (pose) {
    case "loaf":
      return (
        <Svg viewBox="0 0 120 60" {...rest}>
          <path d="M20 30 L19 14 L30 23 Z" />
          <path d="M33 22 L44 13 L44 29 Z" />
          <ellipse cx="32" cy="34" rx="15" ry="13" />
          <path d="M30 48 C 30 24, 60 18, 86 24 C 104 28, 108 44, 104 54 L 26 54 Z" />
          <path d="M25 33 q3 1.6 6 0 M35 33 q3 1.6 6 0" stroke={CUT} strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <path d="M104 52 C 112 54, 112 46, 106 44" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </Svg>
      );
    case "walk":
      return (
        <Svg viewBox="0 0 120 70" {...rest}>
          <ellipse cx="56" cy="34" rx="30" ry="12" />
          <path d="M78 28 C 84 22, 88 22, 92 24 L 90 40 C 86 42, 80 42, 76 40 Z" />
          <ellipse cx="93" cy="26" rx="11" ry="9.5" />
          <path d="M85 20 L86 8 L94 16 Z M95 16 L103 8 L102 21 Z" />
          <path d="M99 24 q2.4 -1.6 4.6 0 q-2.3 1 -4.6 0z" fill={CUT} />
          <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
            <path className="leg-a" d="M80 40 L88 62" />
            <path className="leg-b" d="M74 40 L70 62" />
            <path className="leg-b" d="M40 40 L32 61" />
            <path className="leg-a" d="M34 36 L46 61" />
            <path d="M28 30 C 16 26, 12 14, 20 6" />
          </g>
        </Svg>
      );
    case "peek":
      return (
        <Svg viewBox="0 0 60 28" {...rest}>
          <path d="M14 18 L13 3 L23 11 Z M37 11 L47 3 L46 18 Z" />
          <path d="M10 28 C 10 14, 18 9, 30 9 C 42 9, 50 14, 50 28 Z" />
          <ellipse cx="23" cy="20" rx="3.4" ry="3" fill={CUT} />
          <ellipse cx="37" cy="20" rx="3.4" ry="3" fill={CUT} />
          <ellipse cx="23.6" cy="20" rx="1" ry="2.4" />
          <ellipse cx="37.6" cy="20" rx="1" ry="2.4" />
        </Svg>
      );
    case "head":
      return (
        <Svg viewBox="0 0 40 40" {...rest}>
          <path d="M8 18 L7 3 L17 11 Z" />
          <path d="M23 11 L33 3 L32 18 Z" />
          <ellipse cx="20" cy="23" rx="14" ry="12" />
          <path d="M11.5 21 q3 -2 6 0 q-3 1.3 -6 0z M22.5 21 q3 -2 6 0 q-3 1.3 -6 0z" fill={CUT} />
        </Svg>
      );
    default:
      return (
        <Svg viewBox="0 0 100 120" {...rest}>
          <path d="M24 30 L22 8 L36 20 Z" />
          <path d="M40 20 L52 8 L51 30 Z" />
          <ellipse cx="37" cy="32" rx="15" ry="13" />
          <path d="M28 38 C18 62 21 96 32 112 L73 112 C86 98 84 70 64 52 C55 44 42 38 28 38 Z" />
          <ellipse cx="64" cy="94" rx="19" ry="19" />
          <ellipse cx="33" cy="111" rx="9" ry="3.2" />
          <path d="M76 108 C 98 108, 100 84, 90 70 C 86 64, 88 58, 93 56" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
          <g className="cat-eyes">
            <path d="M26.5 31 q3 -2 6 0.3 q-3 1.1 -6 -0.3z M39.5 31.3 q3 -2.3 6 -0.3 q-3 1.4 -6 0.3z" fill={CUT} />
          </g>
          <path d="M33 37.5 l2 1.4 l2 -1.4z" fill={CUT} />
          <path d="M25 38 L8 35 M25 40 L7 42 M26 41.5 L11 48 M49 38 L62 36 M49 40 L63 42" stroke="currentColor" strokeWidth=".6" fill="none" />
        </Svg>
      );
  }
}

export function Monkey({ pose = "read", ...rest }: Base & { pose?: MonkeyPose }) {
  switch (pose) {
    case "hang":
      return (
        <Svg viewBox="0 0 80 150" {...rest}>
          <path d="M44 0 C 44 4, 34 8, 38 13 C 42 17, 50 18, 48 26 C 46 34, 40 40, 42 54" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="34" cy="62" rx="9" ry="6" transform="rotate(30 34 62)" />
          <ellipse cx="50" cy="62" rx="9" ry="6" transform="rotate(-30 50 62)" />
          <path d="M32 64 C 28 78, 30 92, 41 100 C 52 92, 54 78, 50 64 C 46 58, 36 58, 32 64 Z" />
          <path d="M34 80 C 24 88, 20 98, 22 112" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M48 80 C 58 86, 62 94, 63 104" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="22" cy="114" r="3.5" />
          <path d="M56 104 l14 -2 l1 14 l-14 2z" fill={CUT} stroke="currentColor" strokeWidth="1.8" />
          <circle cx="28" cy="120" r="5" />
          <circle cx="54" cy="120" r="5" />
          <circle cx="41" cy="122" r="13" />
          <g fill={CUT}>
            <circle cx="37" cy="124" r="4.8" />
            <circle cx="45" cy="124" r="4.8" />
            <ellipse cx="41" cy="117" rx="7" ry="5" />
          </g>
          <circle cx="37.5" cy="124.5" r="1.4" />
          <circle cx="44.5" cy="124.5" r="1.4" />
          <path d="M38.5 116 q2.5 -1.4 5 0" stroke="currentColor" strokeWidth=".9" fill="none" strokeLinecap="round" />
        </Svg>
      );
    case "head":
      return (
        <Svg viewBox="0 0 40 40" {...rest}>
          <circle cx="7" cy="21" r="6" />
          <circle cx="33" cy="21" r="6" />
          <circle cx="20" cy="21" r="13" />
          <g fill={CUT}>
            <circle cx="15.5" cy="19" r="5" />
            <circle cx="24.5" cy="19" r="5" />
            <ellipse cx="20" cy="26" rx="7.5" ry="5.5" />
          </g>
          <circle cx="16" cy="19.5" r="1.5" />
          <circle cx="24" cy="19.5" r="1.5" />
        </Svg>
      );
    default:
      return (
        <Svg viewBox="0 0 100 120" {...rest}>
          <circle cx="33" cy="30" r="7" />
          <circle cx="67" cy="30" r="7" />
          <circle cx="50" cy="30" r="16" />
          <circle cx="34" cy="30" r="3.4" fill={CUT} />
          <circle cx="66" cy="30" r="3.4" fill={CUT} />
          <g fill={CUT}>
            <circle cx="44.5" cy="28" r="6.4" />
            <circle cx="55.5" cy="28" r="6.4" />
            <ellipse cx="50" cy="37" rx="9" ry="7" />
          </g>
          <g className="monkey-eyes">
            <circle cx="45" cy="28.5" r="1.7" />
            <circle cx="55" cy="28.5" r="1.7" />
          </g>
          <path d="M47.5 35 q2.5 1 5 0" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M46 40 q4 2.6 8 0" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M38 46 C26 56 24 84 30 100 L70 100 C76 84 74 56 62 46 C56 43 44 43 38 46 Z" />
          <ellipse cx="38" cy="104" rx="17" ry="7" transform="rotate(-10 38 104)" />
          <ellipse cx="62" cy="104" rx="17" ry="7" transform="rotate(10 62 104)" />
          <path d="M28 70 L50 76 L72 70 L72 88 L50 94 L28 88 Z" fill={CUT} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M50 76 L50 94" stroke="currentColor" strokeWidth="1.4" />
          <path d="M33 76 l13 3.4 M33 80 l13 3.4 M33 84 l11 2.9 M54 79.4 l13 -3.4 M54 83.4 l13 -3.4 M54 87.4 l10 -2.6" stroke="currentColor" strokeWidth=".7" />
          <circle cx="27" cy="80" r="5" />
          <circle cx="73" cy="80" r="5" />
          <path d="M76 106 C 96 110, 100 92, 90 86 C 82 81, 76 90, 83 93" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
        </Svg>
      );
  }
}

/** A member's tiny head, in their ink. */
export function Head({ who, size = 16, className = "", style, title }: { who: MemberKey; size?: number; className?: string; style?: CSSProperties; title?: string }) {
  const color = who === "monkey" ? "text-monkey" : "text-cat";
  const props = { width: size, height: size, className: `${color} inline-block shrink-0 ${className}`, style, title };
  return who === "monkey" ? <Monkey pose="head" {...props} /> : <Cat pose="head" {...props} />;
}

/** The full figure for a member: the monkey reads, the cat sits and judges. */
export function Figure({ who, ...rest }: Base & { who: MemberKey }) {
  return who === "monkey" ? <Monkey pose="read" {...rest} /> : <Cat pose="sit" {...rest} />;
}
