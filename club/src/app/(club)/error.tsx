"use client";

import { Monkey } from "@/components/creatures";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
      <Monkey pose="hang" width={44} className="text-monkey" />
      <h1 className="mt-6 font-display text-4xl">An ink blot.</h1>
      <p className="mt-3 max-w-md text-lg italic text-ink-soft">
        Something went wrong while fetching this page. The monkey denies everything.
      </p>
      {error.digest && <p className="typed mt-3 text-xs text-ink-faint">ref. {error.digest}</p>}
      <button type="button" onClick={reset} className="btn mt-8">
        Try again
      </button>
    </div>
  );
}
