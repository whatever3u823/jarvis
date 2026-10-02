"use client";

import { useTransition } from "react";
import { setStatus } from "@/lib/actions/books";

export function StartReading({ bookId, label = "Put it on the desk" }: { bookId: number; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn mt-3 !px-3 !py-1.5 !text-[0.65rem]" disabled={pending} onClick={() => start(() => setStatus(bookId, "reading"))}>
      {pending ? "Opening…" : label}
    </button>
  );
}
