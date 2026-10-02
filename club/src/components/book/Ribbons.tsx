import { member, MEMBER_KEYS, type MemberKey } from "@/club.config";
import { chapterLabel, fractionRead, roman } from "@/lib/chapters";
import type { Book, Readings } from "@/lib/data/types";
import { Head } from "@/components/creatures";

export interface Position {
  who: MemberKey;
  begun: boolean;
  finished: boolean;
  chapter: number;
  page: number | null;
  fraction: number;
}

export function positions(book: Pick<Book, "total_pages" | "total_chapters">, readings: Readings): Record<MemberKey, Position> {
  const out = {} as Record<MemberKey, Position>;
  for (const who of MEMBER_KEYS) {
    const r = readings[who];
    const finished = Boolean(r?.finished_on);
    const chapter = r?.chapter ?? 0;
    const page = r?.page ?? null;
    out[who] = {
      who,
      finished,
      chapter,
      page,
      begun: finished || chapter > 0 || (page ?? 0) > 0,
      fraction: r ? fractionRead({ chapter, page, finished }, book) : 0,
    };
  }
  return out;
}

export function describe(p: Position, book: Pick<Book, "total_pages">): string {
  if (p.finished) return "finished";
  if (!p.begun) return "not yet begun";
  const where = p.chapter > 0 ? chapterLabel(p.chapter) : `page ${p.page}`;
  return `${where}${book.total_pages && p.page ? `, p. ${p.page}` : ""}`;
}

const pct = (f: number) => `${Math.round(f * 100)}%`;

/**
 * The book's page-block seen from above, with each of our ribbons tucked in
 * where we stopped: the monkey's sticks out of the top edge, the cat's out of
 * the bottom. The stretch between them is shaded in the leader's ink.
 */
export function Ribbons({ book, readings, size = "lg" }: { book: Pick<Book, "total_pages" | "total_chapters">; readings: Readings; size?: "sm" | "lg" }) {
  const pos = positions(book, readings);
  const a = pos.monkey;
  const b = pos.cat;
  const lo = Math.min(a.fraction, b.fraction);
  const hi = Math.max(a.fraction, b.fraction);
  const leader: MemberKey | null = a.fraction === b.fraction ? null : a.fraction > b.fraction ? "monkey" : "cat";
  const n = book.total_chapters ?? 0;
  const ticks = n > 1 && n <= 60 ? Array.from({ length: n - 1 }, (_, i) => (i + 1) / n) : [];
  const big = size === "lg";

  return (
    <figure className={big ? "py-[3.6rem]" : "py-10"}>
      <figcaption className="sr-only">
        {MEMBER_KEYS.map((k) => `${member(k).name}: ${describe(pos[k], book)} (${pct(pos[k].fraction)})`).join(". ")}
      </figcaption>
      <div className="relative" aria-hidden>
        <div
          className={`relative overflow-hidden border border-ink/50 ${big ? "h-9" : "h-6"}`}
          style={{
            background:
              "repeating-linear-gradient(90deg, color-mix(in srgb, var(--paper-deep) 92%, var(--ink)) 0 1px, var(--paper-deep) 1px 3px)",
          }}
        >
          <div className="absolute inset-y-0 left-0 bg-ink/14" style={{ width: pct(lo) }} />
          {leader && (
            <div
              className="absolute inset-y-0"
              style={{
                left: pct(lo),
                width: pct(hi - lo),
                background: `repeating-linear-gradient(-45deg, var(--${leader}-wash) 0 4px, transparent 4px 8px), var(--${leader}-wash)`,
              }}
            />
          )}
          {ticks.map((t, i) => (
            <div key={t} className="absolute inset-y-0 w-px bg-ink/30" style={{ left: pct(t) }}>
              {big && n <= 30 && (
                <span className="typed absolute top-1/2 left-1 -translate-y-1/2 text-[0.55rem] text-ink-faint">{roman(i + 2)}</span>
              )}
            </div>
          ))}
          {big && n > 0 && n <= 30 && <span className="typed absolute top-1/2 left-1 -translate-y-1/2 text-[0.55rem] text-ink-faint">I</span>}
        </div>

        {MEMBER_KEYS.map((who) => {
          const p = pos[who];
          const up = who === "monkey";
          const flip = p.fraction > 0.72;
          const m = member(who);
          if (!p.begun) {
            return (
              <div key={who} className={`absolute left-0 flex items-center gap-1.5 ${up ? "bottom-full mb-3" : "top-full mt-3"}`}>
                <Head who={who} size={big ? 18 : 14} className="opacity-50" />
                <span className="text-[0.95rem] italic text-ink-faint">{m.name} hasn’t opened it yet</span>
              </div>
            );
          }
          return (
            <div key={who} className={`absolute ${up ? "bottom-[55%]" : "top-[55%]"}`} style={{ left: `clamp(4px, ${pct(p.fraction)}, calc(100% - 4px))` }}>
              <div
                className={`absolute -translate-x-1/2 ${big ? "w-[9px]" : "w-[7px]"} ${up ? "bottom-0" : "top-0"}`}
                style={{
                  height: big ? "3.3rem" : "2.3rem",
                  background: `var(--${who})`,
                  boxShadow: "inset -2px 0 0 rgb(0 0 0 / .18)",
                  clipPath: up ? "polygon(0 0, 50% 14%, 100% 0, 100% 100%, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%, 50% 86%, 0 100%)",
                }}
              />
              <div
                className={`absolute flex items-center gap-1.5 whitespace-nowrap ${up ? "bottom-[1.6rem]" : "top-[1.6rem]"} ${flip ? "right-2 flex-row-reverse" : "left-2"} ${big ? "" : "text-sm"}`}
              >
                <Head who={who} size={big ? 20 : 15} />
                <span className="leading-none" style={{ fontFamily: m.hand, color: `var(--${who})`, fontSize: big ? (who === "monkey" ? "1.45rem" : "1.05rem") : who === "monkey" ? "1.15rem" : "0.85rem" }}>
                  {p.finished ? "finished!" : p.chapter > 0 ? `ch. ${roman(p.chapter)}` : `p. ${p.page}`}
                </span>
                <span className="typed text-[0.68rem] text-ink-faint">{pct(p.fraction)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
