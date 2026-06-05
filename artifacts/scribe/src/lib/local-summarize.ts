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
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"']|\d)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

/**
 * Extractive summarizer using TF-IDF sentence scoring.
 * Runs entirely in-browser, no network calls, no API key needed.
 *
 * @param text  Raw transcript text
 * @param maxSentences  Number of sentences to include (default 4)
 * @returns Summary as prose (sentences joined in original order)
 */
export function localSummarize(text: string, maxSentences = 4): string {
  const sentences = splitSentences(text);
  if (sentences.length <= maxSentences) return sentences.join(" ");

  const allTokens = sentences.flatMap(tokenize);
  const totalDocs = sentences.length;

  const tf: Map<string, number> = new Map();
  for (const tok of allTokens) tf.set(tok, (tf.get(tok) ?? 0) + 1);

  const df: Map<string, number> = new Map();
  for (const sentence of sentences) {
    const unique = new Set(tokenize(sentence));
    for (const tok of unique) df.set(tok, (df.get(tok) ?? 0) + 1);
  }

  const idf = (tok: string) => Math.log(totalDocs / (1 + (df.get(tok) ?? 0)));

  const scored = sentences.map((sentence, idx) => {
    const tokens = tokenize(sentence);
    if (tokens.length === 0) return { idx, sentence, score: 0 };
    const score =
      tokens.reduce((sum, tok) => {
        const termFreq = (tf.get(tok) ?? 0) / allTokens.length;
        return sum + termFreq * idf(tok);
      }, 0) / tokens.length;
    const positionBoost = idx === 0 ? 1.3 : idx === sentences.length - 1 ? 1.1 : 1.0;
    return { idx, sentence, score: score * positionBoost };
  });

  const topSentences = scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.idx - b.idx)
    .map((s) => s.sentence);

  return topSentences.join(" ");
}
