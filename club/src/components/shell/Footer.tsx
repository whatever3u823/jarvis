import Link from "next/link";
import type { MemberKey } from "@/club.config";
import { Eternity } from "@/components/ornaments";
import { Monkey } from "@/components/creatures";

export function Footer({ reader }: { reader: MemberKey }) {
  return (
    <footer className="group/foot relative mt-24 px-5 pb-28 sm:px-10 md:px-14 md:pb-10">
      <div className="rule" />
      <div className="mt-4 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-[0.95rem] italic text-ink-faint">
          Printed in an edition of two copies. This is no.&nbsp;{reader === "monkey" ? "1, the monkey’s" : "2, the cat’s"}.
        </p>
        <Eternity width={18} height={18} className="text-ink-faint/70" />
        <p className="typed text-[0.68rem] text-ink-faint">
          Not for sale · not for loan ·{" "}
          <Link href="/colophon" className="hover:text-wax" aria-label="Colophon">
            ¶
          </Link>
        </p>
      </div>
      {/* Someone is always hanging around the bottom of the page. */}
      <Monkey
        pose="hang"
        width={26}
        className="pointer-events-none absolute bottom-full left-[18%] translate-y-[115%] rotate-180 text-monkey opacity-0 transition-all delay-700 duration-700 group-hover/foot:translate-y-[62%] group-hover/foot:opacity-100 max-md:hidden"
      />
    </footer>
  );
}
