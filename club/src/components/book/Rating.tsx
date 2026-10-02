"use client";

import { useOptimistic, useTransition } from "react";
import { club, type MemberKey } from "@/club.config";
import { setRating } from "@/lib/actions/reading";
import { Lemon, Pomegranate } from "@/components/ornaments";

/** Five lemons (the monkey) or five pomegranates (the cat). Only your own row can be changed. */
export function Rating({ bookId, who, value, editable }: { bookId: number; who: MemberKey; value: number | null; editable: boolean }) {
  const [optimistic, set] = useOptimistic(value, (_: number | null, next: number | null) => next);
  const [, start] = useTransition();
  const m = club.members[who];
  const Glyph = m.ratingUnit === "lemon" ? Lemon : Pomegranate;
  const unit = m.ratingUnit === "lemon" ? "lemons" : "pomegranates";
  const color = who === "monkey" ? "text-[#b8902a]" : "text-wax";

  return (
    <div className="flex items-center gap-1" role={editable ? "radiogroup" : undefined} aria-label={`${m.name}'s rating, in ${unit}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = optimistic != null && n <= optimistic;
        const glyph = <Glyph filled={filled} width={22} height={22} className={filled ? color : "text-ink-faint/60"} />;
        if (!editable) return <span key={n}>{glyph}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={optimistic === n}
            aria-label={`${n} ${n === 1 ? unit.slice(0, -1) : unit}`}
            className="transition-transform hover:-translate-y-0.5 hover:rotate-6"
            onClick={() =>
              start(async () => {
                const next = optimistic === n ? null : n;
                set(next);
                await setRating(bookId, next);
              })
            }
          >
            {glyph}
          </button>
        );
      })}
      {!editable && optimistic == null && <span className="ml-2 text-sm italic text-ink-faint">no verdict yet</span>}
    </div>
  );
}
