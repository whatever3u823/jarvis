import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-[18vh] text-center">
      <div className="label mb-4">Not in the catalogue</div>
      <h1 className="font-display text-4xl text-ivory">This shelf is empty.</h1>
      <Link href="/" className="mt-8 inline-block font-mono text-[11px] tracking-[0.14em] text-brass uppercase hover:text-brass-bright">
        ← Return to the library
      </Link>
    </div>
  );
}
