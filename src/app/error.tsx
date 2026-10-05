"use client";

/** Runtime errors in a page: say what happened instead of a blank failure. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-[18vh] text-center">
      <div className="label mb-4 text-rust">Something went wrong</div>
      <h1 className="font-display text-4xl text-ivory">This page could not be shown.</h1>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        The server hit an error{error.digest ? ` (reference ${error.digest})` : ""}. The deployment&apos;s function logs have the details.
      </p>
      <button
        onClick={reset}
        className="mt-8 font-mono text-[11px] tracking-[0.14em] text-brass uppercase hover:text-brass-bright"
      >
        Try again
      </button>
    </div>
  );
}
