// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

export const START = "<s?>";

/**
 * Parses data/keymap_words.txt: `word q` per line, most frequent first, where
 * q = -100 * log10(frequency). Returns a Map word -> frequency in file order.
 */
export function parseWords(text) {
  const freq = new Map();
  for (const line of text.split("\n")) {
    if (!line) continue;
    const space = line.indexOf(" ");
    freq.set(line.slice(0, space), 10 ** (-Number(line.slice(space + 1)) / 100));
  }
  return freq;
}

/**
 * Parses data/ngram_model.txt: `history word count word count ...` per line.
 * Returns a Map history -> Map word -> count.
 */
export function parseNgrams(text) {
  const bigrams = new Map();
  for (const line of text.split("\n")) {
    if (!line) continue;
    const parts = line.split(" ");
    const followers = new Map();
    for (let i = 1; i < parts.length; i += 2) {
      followers.set(parts[i], Number(parts[i + 1]));
    }
    bigrams.set(parts[0], followers);
  }
  return bigrams;
}

export class Model {
  /**
   * @param {Map<string, Map<string, number>>} bigrams
   * @param {Map<string, number>} freq unigram frequency of every typable word
   */
  constructor(bigrams, freq) {
    this.bigrams = bigrams;
    this.freq = freq;
  }

  /**
   * Scores candidates given the preceding word. A candidate that follows
   * `history` in the bigram list scores its count. Any other candidate scores
   * `base * unigram frequency`, where `base` is the smallest count/frequency
   * ratio among the bigram candidates, so both groups share one scale. With
   * no bigram candidates `base` stays huge and the ranking is purely by
   * unigram frequency.
   */
  scoreCandidates(history, candidates) {
    const followers = this.bigrams.get(history.toLowerCase() || START);
    let base = 1e18;
    if (followers) {
      for (const word of candidates) {
        const count = followers.get(word);
        if (count !== undefined) base = Math.min(base, count / this.freq.get(word));
      }
    }
    return candidates.map((word) => followers?.get(word) || base * this.freq.get(word));
  }
}
