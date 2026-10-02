/**
 * Everything personal about the club lives here: who the two of us are,
 * what we call ourselves, how we greet each other. Edit freely; the
 * database only ever stores the stable keys ("monkey", "cat").
 */

export type MemberKey = "monkey" | "cat";

export interface Member {
  key: MemberKey;
  /** What the app calls you. */
  name: string;
  /** Your creature, as a title. */
  epithet: string;
  origin: string;
  /** Greeting shown on the desk; `gloss` appears on hover. */
  hello: { text: string; gloss: string };
  goodnight: { text: string; gloss: string };
  /** Tiny dossier lines on the profile page. Placeholders; make them true. */
  habits: string[];
  /** What a rating is counted in. */
  ratingUnit: "lemon" | "pomegranate";
  /** Handwriting used for this member's annotations. */
  hand: string;
}

export const club = {
  name: "The Society of the Monkey & the Cat",
  shortName: "Monkey & Cat",
  /** First day of the club. Shown as "est." in the masthead. */
  founded: "2025-11-14",
  motto: "Felis iudicat, simia legit.",
  mottoGloss: "The cat judges; the monkey reads.",
  /** The colophon (reached by the ¶ in the footer) ends with this. Make it yours. */
  colophonNote:
    "This copy was made for two readers who argue about endings, swap books halfway through, and agree, eventually, on almost everything that matters.",
  /** Dates and "past midnight" moments are reckoned in this zone. */
  timezone: "Europe/Rome",
  members: {
    monkey: {
      key: "monkey",
      name: "Nico",
      epithet: "the Monkey",
      origin: "Sicily",
      hello: { text: "Talìa cu c'è, Nico.", gloss: "Sicilian: look who's here." },
      goodnight: { text: "Bonanotti, Nico. One more chapter?", gloss: "Sicilian: good night." },
      habits: [
        "Reads three books at once and finishes one.",
        "Claims to have “basically finished” at 80%.",
        "Leaves marginal notes with alarming confidence.",
      ],
      ratingUnit: "lemon",
      hand: "var(--font-hand-monkey)",
    },
    cat: {
      key: "cat",
      // Placeholder name — change it to hers.
      name: "Ani",
      epithet: "the Cat",
      origin: "Armenia",
      hello: { text: "Բարև, Ani ջան.", gloss: "Armenian: hello, Ani dear." },
      goodnight: { text: "Բարի գիշեր, Ani ջան.", gloss: "Armenian: good night, dear." },
      habits: [
        "Reads the last page first. Denies it.",
        "Has opinions about translators.",
        "Finishes first, says nothing, waits.",
      ],
      ratingUnit: "pomegranate",
      hand: "var(--font-hand-cat)",
    },
  } satisfies Record<MemberKey, Member>,
} as const;

export const MEMBER_KEYS: readonly MemberKey[] = ["monkey", "cat"];

export function member(key: MemberKey): Member {
  return club.members[key];
}

export function otherMember(key: MemberKey): MemberKey {
  return key === "monkey" ? "cat" : "monkey";
}

export function isMemberKey(value: unknown): value is MemberKey {
  return value === "monkey" || value === "cat";
}
