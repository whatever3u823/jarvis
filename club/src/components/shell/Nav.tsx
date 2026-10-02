"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { club, type MemberKey } from "@/club.config";
import { Head } from "@/components/creatures";

const ITEMS = [
  { href: "/", label: "The Desk", numeral: "i", match: (p: string) => p === "/" },
  { href: "/library", label: "Shelves", numeral: "ii", match: (p: string) => p.startsWith("/library") || p.startsWith("/books") },
  { href: "/archive", label: "Archive", numeral: "iii", match: (p: string) => p.startsWith("/archive") },
];

/** Contents-page navigation for wide screens. */
export function Contents() {
  const path = usePathname();
  return (
    <nav aria-label="Contents" className="flex items-baseline gap-7">
      {ITEMS.map((item) => {
        const active = item.match(path);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="group flex items-baseline gap-1.5">
            <span className="font-display text-sm italic text-ink-faint">{item.numeral}.</span>
            <span className={`label !text-[0.72rem] transition-colors ${active ? "!text-ink" : "group-hover:!text-ink"}`}>
              {item.label}
            </span>
            {active && <span className="sr-only">(current)</span>}
          </Link>
        );
      })}
      <span className="flex items-center gap-2 self-center" aria-label="Members">
        {(["monkey", "cat"] as const).map((k) => (
          <Link key={k} href={`/members/${k}`} aria-label={`${club.members[k].name}, ${club.members[k].epithet}`} aria-current={path === `/members/${k}` ? "page" : undefined} className={`transition-transform hover:-translate-y-0.5 ${path === `/members/${k}` ? "" : "opacity-60 hover:opacity-100"}`}>
            <Head who={k} size={16} />
          </Link>
        ))}
      </span>
    </nav>
  );
}

/** A ribbon of tabs along the bottom of a phone. */
export function PocketNav({ reader, children }: { reader: MemberKey; children: React.ReactNode }) {
  const path = usePathname();
  const you = `/members/${reader}`;
  const items = [...ITEMS, { href: you, label: "You", numeral: "iv", match: (p: string) => p.startsWith("/members") }];
  return (
    <nav
      aria-label="Contents"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/25 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = item.match(path);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className="relative flex flex-col items-center gap-0.5 pt-2.5 pb-2">
                {active && <span className="absolute top-0 h-[3px] w-8 bg-wax" aria-hidden />}
                <span className="font-display text-xs italic text-ink-faint">{item.numeral}</span>
                <span className={`label !text-[0.62rem] ${active ? "!text-ink" : ""}`}>{item.href === you ? children : item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
