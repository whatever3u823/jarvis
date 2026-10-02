import type { Metadata } from "next";
import { club } from "@/club.config";
import { getReader, passphraseRequired } from "@/lib/session";
import { Bookplate } from "@/components/ornaments";
import { ThresholdForm } from "./ThresholdForm";

export const metadata: Metadata = { title: "The threshold" };

export default async function Threshold() {
  const current = await getReader();
  return (
    <div className="flex min-h-dvh items-center justify-center px-3 py-8 sm:py-14">
      <div className="sheet w-full max-w-xl px-6 pt-10 pb-12 sm:px-12">
        <div className="text-center">
          <div className="typed text-[0.7rem] text-ink-faint">{club.name}</div>
          <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
            Members only.
          </h1>
          <p className="mt-2 text-lg italic text-ink-soft">
            <s className="decoration-wax/70 decoration-[1.5px]">All</s> Both of them.
          </p>
        </div>
        <Bookplate compact className="mx-auto mt-8 max-w-[19rem]" />
        <ThresholdForm needsWord={passphraseRequired()} current={current} />
      </div>
    </div>
  );
}
