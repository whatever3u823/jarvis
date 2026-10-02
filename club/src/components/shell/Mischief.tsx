"use client";

import { useEffect, useState } from "react";
import { Cat, Monkey } from "@/components/creatures";

/**
 * Typed words that summon things. Not documented anywhere except here.
 *   "miao" / "meow"  — the cat crosses the bottom of the page.
 *   "ook"            — someone drops in from above. (He is not the Librarian.)
 */
const SPELLS: Record<string, "cat" | "monkey"> = { miao: "cat", meow: "cat", ook: "monkey" };

export function Mischief() {
  const [visitor, setVisitor] = useState<"cat" | "monkey" | null>(null);

  useEffect(() => {
    let typed = "";
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
      typed = (typed + e.key.toLowerCase()).slice(-8);
      for (const [word, who] of Object.entries(SPELLS)) {
        if (typed.endsWith(word)) {
          typed = "";
          setVisitor(who);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!visitor) return null;
  return visitor === "cat" ? (
    <div className="pointer-events-none fixed bottom-2 left-0 z-50 w-24 animate-[stroll_9s_linear_forwards] text-ink md:bottom-4" onAnimationEnd={() => setVisitor(null)} aria-hidden>
      <Cat pose="walk" className="cat-walking w-full" />
    </div>
  ) : (
    <div className="pointer-events-none fixed top-0 right-[22%] z-50 w-14 origin-top animate-[drop-in_4.2s_ease-in-out_forwards] text-monkey" onAnimationEnd={() => setVisitor(null)} aria-hidden>
      <Monkey pose="hang" className="w-full" />
    </div>
  );
}
