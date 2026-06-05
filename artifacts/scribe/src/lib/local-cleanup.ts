/**
 * Local filler-word cleaner — runs entirely in the browser, no API key needed.
 *
 * Removes common spoken filler words and verbal tics from transcript text,
 * then normalises whitespace and punctuation left behind.
 */

const FILLERS = [
  // Multi-word phrases first (order matters — match longer ones before sub-words)
  "you know what i mean",
  "you know what",
  "you know",
  "i mean",
  "i guess",
  "kind of like",
  "sort of like",
  "kind of",
  "sort of",
  "you see",
  "if you will",
  "at the end of the day",
  "to be honest",
  "to be fair",
  "to be clear",
  "at this point in time",
  "for all intents and purposes",
  "needless to say",
  "as a matter of fact",
  "believe it or not",
  "as i said",
  "as i was saying",
  "going forward",
  "in terms of",
  // Single-word fillers
  "basically",
  "literally",
  "actually",
  "honestly",
  "obviously",
  "clearly",
  "certainly",
  "definitely",
  "absolutely",
  "essentially",
  "generally",
  "typically",
  "naturally",
  "simply",
  "like",
  "right",
  "well",
  "okay",
  "ok",
  "so",
  "uh",
  "um",
  "er",
  "ah",
  "hmm",
];

// Build one big alternation regex; match only when surrounded by word boundaries
// or start/end of string, case-insensitive.
function buildFillerRegex(): RegExp {
  const patterns = FILLERS.map((f) =>
    // Escape special regex chars, then wrap in word-boundary anchors
    f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"),
  );
  return new RegExp(
    `(?:^|(?<=\\s|[,;]))(?:${patterns.join("|")})(?=\\s|[,;.!?]|$)`,
    "gi",
  );
}

const FILLER_RE = buildFillerRegex();

/**
 * Remove filler words and tidy up the resulting text.
 *
 * @param text  Raw transcript text
 * @returns  Cleaned transcript text
 */
export function localCleanup(text: string): string {
  let cleaned = text
    .replace(FILLER_RE, "")
    // Collapse multiple commas / leading commas after removal
    .replace(/,\s*,+/g, ",")
    .replace(/^\s*,\s*/gm, "")
    .replace(/,\s*([.!?])/g, "$1")
    // Fix spacing around punctuation
    .replace(/\s+([,;.!?])/g, "$1")
    // Collapse 3+ spaces / blank lines into at most two
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Capitalise the first letter of each sentence that was left lowercase after removal
  cleaned = cleaned.replace(/([.!?]\s+)([a-z])/g, (_, p, l) => p + l.toUpperCase());

  return cleaned;
}
