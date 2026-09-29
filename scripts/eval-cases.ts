/**
 * Retrieval evaluation cases for the development library (public-domain
 * texts: Epictetus, Marcus Aurelius, Dostoevsky, and the TraceMonkey paper).
 * A passage is relevant when it belongs to `book` and contains every needle.
 */
export interface Case {
  query: string;
  /** Substring of the expected book's title. */
  book: string;
  /** All of these must appear in a relevant passage. */
  needles: string[];
}

export const DEFAULT_CASES: Case[] = [
  { query: "the distinction between what is up to us and what is not", book: "Epictetus", needles: ["Of things some are in our power"] },
  { query: "people are upset not by events themselves but by their judgments about them", book: "Epictetus", needles: ["not by the things"] },
  { query: "what to do when you hear that someone has been criticising you behind your back", book: "Epictetus", needles: ["speaks ill of you"] },
  { query: "responding to a ruler who threatens to imprison and kill you", book: "Epictetus", needles: ["But the tyrant will chain"] },
  { query: "after a theft he consoles himself that he only lost a cheap object", book: "Epictetus", needles: ["earthen lamp"] },
  { query: "a man may prefer pain to happiness and be in love with it", book: "Underground", needles: ["passionately, in love with suffering"] },
  { query: "the narrator introduces himself as ill and malicious", book: "Underground", needles: ["I am a sick man"] },
  { query: "the nightmare in which drunk peasants flog an old horse to death", book: "Crime", needles: ["Mikolka", "mare"] },
  { query: "she reads him the gospel story of a man raised from the dead", book: "Crime", needles: ["Lazarus"] },
  { query: "each morning expect to meet ungrateful, meddling and arrogant people", book: "Meditations", needles: ["morning", "unthankful"] },
  { query: "the emperor lists the virtues he learned from his relatives and teachers", book: "Meditations", needles: ["grandfather Verus"] },
  { query: "how the compiler handles loops inside loops when recording traces", book: "Trace", needles: ["nested trace tree"] },
  { query: "the hyper-conscious mouse cannot believe its revenge is simply justice", book: "Underground", needles: ["the mouse does not believe in the justice"] },
  { query: "an officer shifted him aside as if he were not there, and that insult he could never forgive", book: "Underground", needles: ["could not forgive his having moved me"] },
  { query: "the court decided the killing came from a fit of madness since he never even looked inside the purse", book: "Crime", needles: ["temporary mental derangement"] },
  { query: "someone who believes something false harms only himself", book: "Epictetus", needles: ["he is the person who is hurt"] },
  { query: "he warns her she will sink from house to house until she ends up where visitors beat the girls", book: "Underground", needles: ["Haymarket"] },
  { query: "do each task with seriousness, affection, freedom and justice, as a Roman should", book: "Meditations", needles: ["as a Roman and a man"] },
  { query: "god made you and handed you over to your own keeping, so do not dishonour the maker", book: "Epictetus", needles: ["made you a deposit to yourself"] },
  { query: "earlier research compiled several versions of a procedure, each specialised for particular argument types", book: "Trace", needles: ["Chambers"] },
  { query: "at the farewell dinner he gets drunk on wine out of embarrassment and wants to insult everyone", book: "Underground", needles: ["sherry and Lafitte"] },
  { query: "only the educated are truly free, not a slave the magistrate has formally released", book: "Epictetus", needles: ["allow none to be free except the educated"] },
  { query: "the investigator pretends to muddle which day the decorators were working in the flat", book: "Crime", needles: ["painters were at work"] },
  { query: "his sister regards the young woman who will follow him into exile with near veneration", book: "Crime", needles: ["with reverence"] },
  // Queries that share distinctive words or names with the text.
  { query: "What does Epictetus say about the things within our power?", book: "Epictetus", needles: ["Of things some are in our power"] },
  { query: "Mikolka and the mare", book: "Crime", needles: ["Mikolka", "mare"] },
  { query: "Sonia reading the raising of Lazarus", book: "Crime", needles: ["Lazarus", "Sonia"] },
  { query: "the earthen lamp", book: "Epictetus", needles: ["earthen lamp"] },
  { query: "what he learned from his grandfather Verus", book: "Meditations", needles: ["grandfather Verus"] },
  { query: "spite and the spiteful official", book: "Underground", needles: ["spiteful"] },
  // Rare exact terms, where keyword matching should help.
  { query: "hupolaepsis", book: "Epictetus", needles: ["hupolaepsis"] },
  { query: "the story about Felicion", book: "Epictetus", needles: ["Felicion"] },
  { query: "Epaphroditus", book: "Epictetus", needles: ["Epaphroditus"] },
  { query: "what did Rusticus teach him", book: "Meditations", needles: ["Rusticus"] },
];
