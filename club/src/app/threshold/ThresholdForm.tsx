"use client";

import { useActionState, useState } from "react";
import { club, MEMBER_KEYS, type MemberKey } from "@/club.config";
import { enter } from "@/lib/actions/session";
import { IDLE } from "@/lib/actions/state";
import { Figure } from "@/components/creatures";

export function ThresholdForm({ needsWord, current }: { needsWord: boolean; current: MemberKey | null }) {
  const [state, action, pending] = useActionState(enter, IDLE);
  const [who, setWho] = useState<MemberKey | null>(current);

  return (
    <form action={action} className="mt-10">
      <fieldset>
        <legend className="label mx-auto block text-center">Who is reading?</legend>
        <div className="mt-6 grid grid-cols-2 gap-4">
          {MEMBER_KEYS.map((key) => {
            const m = club.members[key];
            const chosen = who === key;
            return (
              <label key={key} className="group relative flex cursor-pointer flex-col items-center gap-3 pt-2 pb-3">
                <input
                  type="radio"
                  name="member"
                  value={key}
                  checked={chosen}
                  onChange={() => setWho(key)}
                  className="peer sr-only"
                />
                <Figure
                  who={key}
                  className={`h-28 transition-all duration-300 sm:h-32 ${key === "monkey" ? "text-monkey" : "text-cat -scale-x-100"} ${
                    who && !chosen ? "opacity-35 grayscale" : ""
                  } group-hover:-translate-y-1`}
                />
                <span className="text-center leading-none">
                  <span className="block text-3xl" style={{ fontFamily: m.hand, color: `var(--${key})` }}>
                    {m.name}
                  </span>
                  <span className="label mt-2 block">{m.epithet}</span>
                </span>
                <svg viewBox="0 0 120 10" className={`h-2.5 w-24 transition-opacity ${chosen ? "opacity-100" : "opacity-0"}`} aria-hidden>
                  <path d="M3 6 C 30 2, 60 9, 117 4" fill="none" stroke={`var(--${key})`} strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="pointer-events-none absolute inset-0 peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-dashed peer-focus-visible:outline-ink-soft" />
              </label>
            );
          })}
        </div>
      </fieldset>

      {needsWord && (
        <label className="mx-auto mt-8 block max-w-xs">
          <span className="label">The word</span>
          <input name="passphrase" type="password" autoComplete="current-password" className="field mt-1 text-center" placeholder="you know the one" />
        </label>
      )}

      <div className="mt-9 flex flex-col items-center gap-3">
        <button type="submit" className="btn btn-solid" disabled={pending || !who}>
          {pending ? "Unlocking…" : "Open the reading room"}
        </button>
        <p role="status" aria-live="polite" className="min-h-[1.5rem] text-center italic text-wax">
          {state.error}
        </p>
      </div>
    </form>
  );
}
