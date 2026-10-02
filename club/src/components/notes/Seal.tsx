"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { breakSeal } from "@/lib/actions/thoughts";
import { WaxSeal } from "@/components/ornaments";

const HOLD_MS = 1100;

/**
 * Notes beyond your bookmark lie under wax. Opening them takes a deliberate
 * press-and-hold (or holding Enter / Space), never an accidental click, and
 * the other one will see in the timeline that you did.
 */
export function Seal({ bookId, chapter, children, size = "lg" }: { bookId: number; chapter: number; children?: React.ReactNode; size?: "sm" | "lg" }) {
  const [progress, setProgress] = useState(0);
  const [cracked, setCracked] = useState(false);
  const [pending, startTransition] = useTransition();
  const raf = useRef<number | null>(null);
  const started = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    started.current = null;
    setProgress((p) => (p >= 1 ? p : 0));
  }, []);

  const tick = useCallback(() => {
    if (started.current == null) return;
    const p = Math.min(1, (performance.now() - started.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      raf.current = null;
      started.current = null;
      setCracked(true);
      navigator.vibrate?.(30);
      startTransition(() => breakSeal(bookId, chapter));
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }, [bookId, chapter]);

  const begin = useCallback(() => {
    if (cracked || started.current != null) return;
    started.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  }, [cracked, tick]);

  useEffect(() => stop, [stop]);

  const big = size === "lg";
  const r = 46;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center text-center">
      <button
        type="button"
        className="relative touch-none select-none outline-offset-8"
        style={{ width: big ? 112 : 72, height: big ? 112 : 72, WebkitTouchCallout: "none" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          begin();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
            e.preventDefault();
            begin();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") stop();
        }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Hold to break the seal"
        aria-describedby={`seal-hint-${bookId}-${chapter}`}
        disabled={cracked}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-[-10%] h-[120%] w-[120%] -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--rule)" strokeWidth="1" strokeDasharray="2 3" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--wax)"
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
          />
        </svg>
        {cracked ? (
          <>
            <span className="absolute inset-0 animate-[crack-left_800ms_ease-out_forwards]" style={{ clipPath: "polygon(0 0, 52% 0, 44% 30%, 56% 55%, 46% 100%, 0 100%)" }}>
              <WaxSeal className="h-full w-full" />
            </span>
            <span className="absolute inset-0 animate-[crack-right_800ms_ease-out_forwards]" style={{ clipPath: "polygon(52% 0, 100% 0, 100% 100%, 46% 100%, 56% 55%, 44% 30%)" }}>
              <WaxSeal className="h-full w-full" />
            </span>
          </>
        ) : (
          <span className="absolute inset-0" style={{ transform: `scale(${1 - progress * 0.06}) rotate(${progress * 5}deg)` }}>
            <WaxSeal className="h-full w-full drop-shadow-[0_2px_2px_rgb(0_0_0/.35)]" />
          </span>
        )}
      </button>
      <p id={`seal-hint-${bookId}-${chapter}`} className={`mt-5 text-ink-faint italic ${big ? "text-base" : "text-sm"}`}>
        {pending || cracked ? "Breaking the wax…" : progress > 0 ? "Keep holding…" : (children ?? "Press and hold the seal to read on.")}
      </p>
    </div>
  );
}
