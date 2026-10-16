// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

const PREFIX_POOL = 40; // likeliest words kept per key prefix
const PREFIX_SHOWN = 3; // prefix-only candidates offered
const PREFIX_PENALTY = 10;

/** Words indexed by the key sequence that types them, and by its prefixes. */
export class Lexicon {
  /**
   * @param {Map<string, number>} freq words, most frequent first
   * @param {Record<string, string[]>} keyMap token -> letters on that key
   */
  constructor(freq, keyMap) {
    const letterKey = new Map();
    for (const [token, letters] of Object.entries(keyMap)) {
      for (const letter of letters) letterKey.set(letter, token);
    }
    this.setup = new Map(); // full key sequence -> words
    this.prefixMap = new Map(); // proper prefix -> likeliest longer words
    for (const word of freq.keys()) {
      let keys = "";
      for (const letter of word) {
        const token = letterKey.get(letter);
        if (token === undefined) throw new Error(`No key for "${letter}" in "${word}"`);
        keys += token;
      }
      push(this.setup, keys, word, Infinity);
      for (let i = 1; i < keys.length; i++) {
        push(this.prefixMap, keys.slice(0, i), word, PREFIX_POOL);
      }
    }
  }
}

function push(map, key, word, limit) {
  const list = map.get(key);
  if (list === undefined) map.set(key, [word]);
  else if (list.length < limit) list.push(word);
}

const byScoreDesc = (a, b) => b[1] - a[1];

/**
 * Candidates for the typed key sequence, best first, as [word, score] pairs.
 * The first choice is never a prefix-only match.
 */
export function getCandidates(context, seq, model, lexicon) {
  if (!seq) return [];

  const contextWords = context.trim().split(/\s+/).filter(Boolean);
  const history = contextWords.length ? contextWords[contextWords.length - 1] : "";

  const exact = lexicon.setup.get(seq) ?? [];
  const prefix = lexicon.prefixMap.get(seq) ?? [];

  // Score both groups together so they share one backoff scale.
  const scores = model.scoreCandidates(history, exact.concat(prefix));
  const exactMatches = exact.map((word, i) => [word, scores[i]]).sort(byScoreDesc);
  const prefixMatches = prefix
    .map((word, i) => [word, scores[exact.length + i] / PREFIX_PENALTY])
    .sort(byScoreDesc)
    .slice(0, PREFIX_SHOWN);

  if (exactMatches.length) {
    const rest = exactMatches.slice(1).concat(prefixMatches).sort(byScoreDesc);
    return [exactMatches[0], ...rest];
  }
  return prefixMatches;
}
