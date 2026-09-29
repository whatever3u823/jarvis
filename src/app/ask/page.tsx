import type { Metadata } from "next";
import { AskPanel } from "@/components/ask/AskPanel";
import { hasAnthropicCredentials } from "@/lib/config";

export const metadata: Metadata = { title: "Ask the library" };
export const dynamic = "force-dynamic";

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 md:px-8">
      <header className="mb-10">
        <div className="label mb-3">Research</div>
        <h1 className="font-display text-[40px] leading-none text-ivory">Ask the library</h1>
        {!hasAnthropicCredentials() && (
          <p className="mt-4 border-l border-rust/60 pl-3 text-[13px] text-muted">
            <span className="font-mono text-[10.5px] tracking-[0.14em] text-rust uppercase">No API key</span> — set{" "}
            <code className="font-mono text-parchment">ANTHROPIC_API_KEY</code> in <code className="font-mono text-parchment">.env</code> to
            generate answers. Retrieval still works: you will see the passages found for each question.
          </p>
        )}
      </header>
      <AskPanel initialQuestion={q} />
    </div>
  );
}
