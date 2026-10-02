import Link from "next/link";
import { Cat } from "@/components/creatures";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="typed text-xs text-ink-faint">Call no. 404</div>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl">Borrowed, and not returned.</h1>
      <p className="mt-4 text-lg italic text-ink-soft">This isn’t on any shelf. The cat suspects the monkey.</p>
      <Cat pose="sit" className="mt-8 h-24 text-cat" />
      <Link href="/library" className="btn mt-8">
        Back to the shelves
      </Link>
    </div>
  );
}
