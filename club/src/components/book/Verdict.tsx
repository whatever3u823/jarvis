import { club } from "@/club.config";
import { Cat } from "@/components/creatures";
import type { Position } from "./Ribbons";

/** The cat's running commentary on the monkey's progress, in her own hand. */
export function verdict(monkey: Position, cat: Position): string {
  if (monkey.finished && cat.finished) return "finished, both. the cat approves (quietly).";
  if (!monkey.begun && !cat.begun) return "unopened. the cat is sitting on it, for now.";
  if (!monkey.begun) return "the monkey has not opened it. the cat has noticed.";
  if (cat.finished) return "the cat has finished. the cat is waiting. the cat has all the time in the world.";
  if (monkey.finished) return "the monkey claims to have finished. the cat requests evidence.";
  const gap = cat.chapter - monkey.chapter;
  if (gap >= 3) return `${gap} chapters behind. the cat is being patient. visibly.`;
  if (gap > 0) return "close. but behind.";
  if (gap === 0) return "neck and neck. the cat remains unimpressed.";
  if (gap > -3) return "slightly ahead. suspicious.";
  return "suspiciously fast. skimming is suspected.";
}

export function Verdict({ monkey, cat, className = "" }: { monkey: Position; cat: Position; className?: string }) {
  return (
    <aside className={`flex items-end gap-2 ${className}`} aria-label="A remark from the cat">
      <p className="max-w-[13rem] -rotate-2 text-right text-[0.95rem] leading-snug" style={{ fontFamily: club.members.cat.hand, color: "var(--cat)" }}>
        {verdict(monkey, cat)}
      </p>
      <Cat pose="sit" width={34} className="shrink-0 -scale-x-100 text-cat" />
    </aside>
  );
}
