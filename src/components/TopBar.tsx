"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SearchBox } from "./SearchBox";
import { useUpload } from "./UploadProvider";

export function TopBar() {
  const pathname = usePathname();
  const { pickFiles } = useUpload();
  const onHome = pathname === "/";
  const inReader = /\/read$/.test(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/92 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 md:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label="Library home">
          <span className="block h-3 w-3 rotate-45 border border-brass transition-colors group-hover:bg-brass/20" />
          <span className="font-mono text-[12px] tracking-[0.42em] text-ivory">JARVIS</span>
          <span className="hidden h-4 w-px bg-line-strong lg:block" />
          <span className="hidden font-display text-[15px] text-muted italic lg:block">private library</span>
        </Link>

        <div className="min-w-0 flex-1">
          {!onHome && !inReader && (
            <div className="mx-auto hidden max-w-xl md:block">
              <Suspense fallback={<SearchBox variant="bar" primary />}>
                <BarSearch primary />
              </Suspense>
            </div>
          )}
        </div>

        <nav className="flex shrink-0 items-center gap-4 font-mono text-[11px] tracking-[0.14em] uppercase md:gap-5">
          <NavLink href="/" active={onHome || pathname.startsWith("/books")}>
            Library
          </NavLink>
          <NavLink href="/ask" active={pathname.startsWith("/ask")}>
            Ask
          </NavLink>
          <button
            onClick={pickFiles}
            className="rounded-sm border border-line-strong px-3 py-1.5 text-parchment transition-colors hover:border-brass-dim hover:text-brass"
          >
            + Add
          </button>
        </nav>
      </div>
      {!onHome && !inReader && (
        <div className="px-4 pb-3 md:hidden">
          <Suspense fallback={<SearchBox variant="bar" />}>
            <BarSearch />
          </Suspense>
        </div>
      )}
    </header>
  );
}

/** The top-bar search reflects the query being viewed on /search and /ask. */
function BarSearch({ primary }: { primary?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const q = pathname === "/search" || pathname === "/ask" ? (params.get("q") ?? "") : "";
  return <SearchBox variant="bar" primary={primary} initialQuery={q} initialMode={pathname === "/ask" ? "ask" : "search"} />;
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`transition-colors ${active ? "text-ivory" : "text-muted hover:text-parchment"}`}>
      {children}
    </Link>
  );
}
