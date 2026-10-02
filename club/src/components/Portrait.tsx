"use client";

import { useState } from "react";
import { club, type MemberKey } from "@/club.config";
import { Figure } from "@/components/creatures";

/**
 * A portrait in an oval frame. Touch it and something small happens; what
 * happens depends on who it is.
 */
export function Portrait({ who }: { who: MemberKey }) {
  const [touched, setTouched] = useState(0);
  const [moving, setMoving] = useState(false);
  const caption =
    who === "cat"
      ? "a slow blink. (in cat, this means what you think it means.)"
      : touched > 2
        ? "ook. *"
        : "the monkey turns a page, pretending not to notice.";

  return (
    <figure className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => {
          setTouched((n) => n + 1);
          setMoving(true);
        }}
        onAnimationEnd={() => setMoving(false)}
        className="relative flex h-64 w-52 items-center justify-center rounded-[50%] border-[3px] border-double border-ink/60 bg-paper-deep/60 shadow-[inset_0_0_30px_rgb(var(--shadow)/.18)]"
        aria-label={`The portrait of ${club.members[who].name}`}
      >
        <span className="absolute inset-2 rounded-[50%] border border-ink/20" aria-hidden />
        <Figure
          who={who}
          className={`h-40 ${who === "monkey" ? "text-monkey" : "-scale-x-100 text-cat"} ${moving ? (who === "cat" ? "blinking" : "animate-[hop_600ms_ease-out]") : ""}`}
        />
      </button>
      <figcaption
        className={`mt-4 max-w-[15rem] text-center text-[1rem] transition-opacity duration-700 ${touched ? "opacity-100" : "opacity-0"}`}
        style={{ fontFamily: club.members[who].hand, color: `var(--${who})`, fontSize: who === "monkey" ? "1.3rem" : "0.95rem" }}
        aria-live="polite"
      >
        {touched ? caption : " "}
      </figcaption>
    </figure>
  );
}
