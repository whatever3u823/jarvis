/** Bookcloth for books without a cover image, chosen by title so it never changes. */
const CLOTHS = [
  { cloth: "#5b2620", ink: "#e8d6ae", name: "oxblood" },
  { cloth: "#25392e", ink: "#e2d3a8", name: "bottle green" },
  { cloth: "#1f2a44", ink: "#e4d4ae", name: "navy" },
  { cloth: "#6a4725", ink: "#f0e0bb", name: "tobacco" },
  { cloth: "#2a2420", ink: "#d3b878", name: "black, gilt" },
  { cloth: "#7b5b3b", ink: "#f3e5c4", name: "tan" },
  { cloth: "#4b3450", ink: "#e9d8bb", name: "plum" },
  { cloth: "#93712f", ink: "#2a1f14", name: "ochre" },
  { cloth: "#3d4838", ink: "#e7d9b6", name: "olive" },
  { cloth: "#b3a382", ink: "#2b2219", name: "linen" },
  { cloth: "#6e2b36", ink: "#efdcc0", name: "claret" },
  { cloth: "#2f4a52", ink: "#e5d6b2", name: "teal" },
] as const;

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clothFor(title: string, author: string) {
  return CLOTHS[hash(`${author}|${title}`) % CLOTHS.length];
}

/** A stable pseudo-random number in [0, 1) for decorative irregularity. */
export function wobble(seed: string | number, salt = 0): number {
  return (hash(`${seed}:${salt}`) % 10_000) / 10_000;
}
