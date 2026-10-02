"use client";

import { useState } from "react";
import { toggleLamp } from "@/lib/actions/session";

/** Pull the cord: the lamp goes low (or comes back up). */
export function LampCord({ lamp }: { lamp: "day" | "night" }) {
  const [pulling, setPulling] = useState(false);
  return (
    <form action={toggleLamp} className="absolute top-0 right-6 z-30 sm:right-10" onSubmit={() => setPulling(true)}>
      <button
        type="submit"
        className="group flex flex-col items-center px-2"
        aria-label={lamp === "night" ? "Turn the lamp up" : "Turn the lamp down"}
        title={lamp === "night" ? "Lamp up" : "Lamp down"}
      >
        <span
          className={`block w-px bg-ink-faint transition-[height] duration-300 ease-out ${pulling ? "h-14" : "h-9 group-hover:h-11"}`}
          aria-hidden
        />
        <span className="block h-3 w-2 rounded-b-full rounded-t-sm bg-gilt shadow-[0_1px_2px_rgb(0_0_0/.4)]" aria-hidden />
      </button>
    </form>
  );
}
