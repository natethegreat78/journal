const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by",
  "from","up","about","into","through","during","is","are","was","were","be",
  "been","being","have","has","had","do","does","did","will","would","could",
  "should","may","might","shall","can","that","this","these","those","it","its",
  "i","you","he","she","we","they","me","him","her","us","them","my","your",
  "his","our","their","what","which","who","not","so","if","then","than","as",
  "just","also","more","very","all","some","any","there","here","when","where",
  "how","each","both","few","no","yes","said","say","says","get","got","go",
  "going","make","made","know","think","look","see","come","take","use","want",
  "good","great","like","really","well","yeah","okay","right","actually","um",
  "uh","lot","thing","things","way","ways","need","needs","one","two","three",
  "first","second","third","last","next","new","old","many","much","every",
  "time","times","day","days","year","years","work","working","worked","today",
  "people","person","point","points","talk","talking","talked","kind","sort",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

function countFrequencies(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return freq;
}

/** Adjacent bigrams from a token list (e.g. ["mobile", "notifications"]) */
function bigrams(tokens: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    result.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return result;
}

export const TAG_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6",
];

/**
 * Extract 3-5 short topic tags from raw transcript text.
 * Uses term frequency to find the most prominent unigrams and bigrams.
 * Runs entirely in the browser — no API key required.
 */
export function localAutotag(text: string, maxTags = 5): string[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];

  const uniFreq = countFrequencies(tokens);
  const biFreq = countFrequencies(bigrams(tokens));

  // Score: frequency squared / token length (penalise very long terms slightly)
  const candidates: { label: string; score: number }[] = [];

  for (const [term, freq] of uniFreq) {
    if (freq < 2) continue; // must appear at least twice to be a topic
    candidates.push({ label: term, score: freq * freq });
  }

  for (const [term, freq] of biFreq) {
    if (freq < 2) continue;
    // Boost bigrams — they're more specific and tag-like
    candidates.push({ label: term, score: freq * freq * 1.5 });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Deduplicate: skip unigrams already covered by a higher-scoring bigram
  const chosen: string[] = [];
  for (const { label } of candidates) {
    if (chosen.length >= maxTags) break;
    const alreadyCovered = chosen.some(
      (c) => c.includes(label) || label.includes(c),
    );
    if (!alreadyCovered) chosen.push(label);
  }

  return chosen;
}
