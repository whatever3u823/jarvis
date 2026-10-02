import Link from "next/link";
import { Cat } from "@/components/creatures";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-3">
      <div className="sheet w-full max-w-lg px-8 py-14 text-center">
        <div className="typed text-xs text-ink-faint">Call no. 404</div>
        <h1 className="mt-4 font-display text-4xl">Borrowed, and not returned.</h1>
        <p className="mt-4 text-lg italic text-ink-soft">This page isn’t on any shelf. The cat suspects the monkey.</p>
        <Cat pose="sit" className="mx-auto mt-8 h-24 text-cat" />
        <Link href="/" className="btn mt-8">Back to the desk</Link>
      </div>
    </div>
  );
}
