import type { SetupStatus } from "@/lib/setup";

/** Shown instead of the library until the deployment has what it needs. */
export function SetupScreen({ status }: { status: SetupStatus }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-[10vh] pb-24">
      <div className="flex items-center gap-3">
        <span className="block h-3 w-3 rotate-45 border border-brass" />
        <span className="font-mono text-[12px] tracking-[0.42em] text-ivory">JARVIS</span>
      </div>
      <h1 className="mt-8 font-display text-[40px] leading-tight text-ivory">The library is not set up yet.</h1>
      <p className="mt-3 font-serif text-[18px] leading-relaxed text-parchment">
        A few pieces are missing. Complete the items marked below, redeploy, and reload this page.
      </p>
      <ol className="mt-10 divide-y divide-line border-y border-line">
        {status.items.map((item) => (
          <li key={item.key} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 py-5">
            <span className={`pt-0.5 font-mono text-[13px] ${item.ok ? "text-sage" : item.required ? "text-rust" : "text-faint"}`}>
              {item.ok ? "✓" : item.required ? "✗" : "○"}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-[18px] text-ivory">{item.label}</span>
                {!item.required && <span className="label">optional</span>}
              </div>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">{item.detail}</p>
              {!item.ok && item.fix && <p className="mt-2 border-l border-brass-dim pl-3 text-[14px] leading-relaxed text-parchment">{item.fix}</p>}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 font-mono text-[10.5px] leading-relaxed text-faint">
        Environment variables are read when a deployment starts: after adding or changing one in Vercel, redeploy (Deployments → ⋯ → Redeploy).
      </p>
    </div>
  );
}
