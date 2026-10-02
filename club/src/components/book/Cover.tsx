"use client";

import { useEffect, useRef, useState } from "react";
import { clothFor } from "@/lib/cloth";
import { Fleuron } from "@/components/ornaments";

interface Props {
  title: string;
  author: string;
  src: string | null;
  /** Width in rem; height follows a 2:3 book. */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  tilt?: number;
}

const SIZES = {
  xs: "w-10",
  sm: "w-16",
  md: "w-28",
  lg: "w-40 sm:w-48",
  xl: "w-44 sm:w-56 lg:w-64",
};

/**
 * A book as an object: either its printed cover, or — when there is none, or
 * it fails to load — a cloth binding with the title stamped on it.
 */
export function Cover({ title, author, src, size = "md", className = "", tilt = 0 }: Props) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An image that failed before hydration never fires onError; check once mounted.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);
  const showImage = src && !failed;
  const { cloth, ink } = clothFor(title, author);
  const small = size === "xs" || size === "sm";

  return (
    <div
      className={`relative aspect-[2/3] shrink-0 ${SIZES[size]} ${className}`}
      style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}
    >
      <div
        className="absolute inset-0 overflow-hidden rounded-[2px_4px_4px_2px]"
        style={{
          boxShadow: "inset 3px 0 0 rgb(0 0 0 / .18), inset 4px 0 0 rgb(255 255 255 / .06), 0 1px 1px rgb(0 0 0 / .25), 0 8px 18px -6px rgb(var(--shadow) / .55)",
          backgroundColor: cloth,
        }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={img}
            src={src}
            alt={`Cover of ${title}`}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full flex-col items-center justify-between text-center"
            style={{
              color: ink,
              padding: small ? "12% 8%" : "12% 10%",
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><filter id='c'><feTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .25 0'/></filter><rect width='100%' height='100%' filter='url(%23c)'/></svg>\")",
            }}
            role="img"
            aria-label={`${title}, by ${author}`}
          >
            <div className="absolute inset-[6%] border opacity-50" style={{ borderColor: ink }} />
            {small ? (
              <div className="font-display leading-tight" style={{ fontSize: size === "xs" ? "0.35rem" : "0.5rem" }}>
                {title}
              </div>
            ) : (
              <>
                <div className="font-sans uppercase tracking-[0.2em] opacity-80" style={{ fontSize: "0.5rem" }}>
                  {author}
                </div>
                <div className="font-display leading-[1.05] text-balance" style={{ fontSize: size === "md" ? "0.9rem" : "1.35rem" }}>
                  {title}
                </div>
                <Fleuron width={22} height={13} className="opacity-80" />
              </>
            )}
          </div>
        )}
        {/* the hinge */}
        <div className="pointer-events-none absolute inset-y-0 left-[5%] w-px bg-black/20" />
      </div>
    </div>
  );
}
