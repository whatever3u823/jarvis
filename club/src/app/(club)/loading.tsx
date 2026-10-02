import { Cat } from "@/components/creatures";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4" role="status">
      <Cat pose="walk" className="cat-walking w-20 text-ink-faint" />
      <p className="italic text-ink-faint">Fetching it from the stacks…</p>
    </div>
  );
}
