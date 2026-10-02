import Link from "next/link";
import { club, member, type MemberKey } from "@/club.config";
import { archivalDate } from "@/lib/format";
import { Cat, Head, Monkey } from "@/components/creatures";
import { Contents } from "./Nav";

export function Masthead({ reader }: { reader: MemberKey }) {
  const me = member(reader);
  return (
    <header className="px-5 pt-6 sm:px-10 md:px-14 md:pt-9">
      <div className="flex items-start justify-between gap-6">
        <Link href="/" className="group flex items-end gap-3" aria-label={`${club.name}, the desk`}>
          <span className="relative hidden h-12 w-[4.4rem] shrink-0 xs:block" aria-hidden>
            <Monkey pose="head" width={30} className="absolute bottom-0 left-0 text-monkey transition-transform duration-300 group-hover:-rotate-12" />
            <Cat pose="head" width={30} className="absolute right-0 bottom-1 text-cat transition-transform duration-300 group-hover:rotate-12" />
          </span>
          <span className="leading-none">
            <span className="block font-display text-[0.95rem] italic text-ink-soft">The Society of the</span>
            <span className="block font-display text-[1.7rem] tracking-[-0.01em] sm:text-[2.1rem]">
              Monkey <span className="italic text-ink-soft">&amp;</span> the Cat
            </span>
          </span>
        </Link>
        <div className="hidden pt-1 pr-14 text-right md:block">
          <div className="typed text-[0.7rem] text-ink-faint">
            Vol. I · est. {archivalDate(club.founded)}
          </div>
          <Link href={`/members/${reader}`} className="mt-1.5 inline-flex items-center gap-2 text-ink-soft hover:text-ink">
            <span className="label">reading as</span>
            <Head who={reader} size={18} />
            <span className="text-[1.15rem] leading-none" style={{ fontFamily: me.hand, color: `var(--${reader})` }}>
              {me.name}
            </span>
          </Link>
        </div>
      </div>
      <div className="rule-double mt-5" />
      <div className="mt-3 hidden items-center justify-between md:flex">
        <Contents />
        <div className="typed text-[0.7rem] text-ink-faint">two members · no vacancies</div>
      </div>
    </header>
  );
}
