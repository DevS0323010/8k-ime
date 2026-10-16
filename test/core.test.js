// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010
//
// Run with `node --test`. Replays test/golden.json (made by test/gen_golden.py
// from the Python prototype) against the JS core.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createIME, Model } from "../src/core/index.js";
import { parseNgrams, parseWords } from "../src/core/model.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const layout = JSON.parse(read("../src/layout/en.json"));
const golden = JSON.parse(read("./golden.json"));
const words = read("../data/keymap_words.txt");
const ngrams = read("../data/ngram_model.txt");

/**
 * Compares the first options with the prototype's. The scores of an exact and a
 * prefix match can be mathematically exactly 10x apart, and then the last bit
 * of Math.pow vs Python's pow decides their order. So a swap is accepted when
 * the two scores involved are equal to within 1e-9 relative.
 */
function assertSameRanking(ime, expected, where) {
  const got = ime.options.slice(0, expected.length);
  const score = (word) => {
    const i = ime.options.indexOf(word);
    assert.ok(i >= 0, `"${word}" is missing from the options, ${where}`);
    return ime.optionScores[i];
  };
  got.forEach((word, i) => {
    if (word === expected[i]) return;
    const a = ime.optionScores[i];
    const b = score(expected[i]);
    assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(a, b), `options differ at ${i}: ${got} vs ${expected}, ${where}`);
  });
}

test("replays the Python prototype step for step", () => {
  const ime = createIME(layout, words, ngrams);
  for (const { tokens, steps } of golden) {
    Object.assign(ime, { buffer: "", context: "", options: [], optionScores: [], optionId: -1, mode: "0" });
    let lastKeys = null;
    [...tokens].forEach((token, i) => {
      const where = `tokens "${tokens}", step ${i + 1} (${token})`;
      const actions = ime.input(token).map((a) => (a.type === "insert" ? ["insert", a.text] : [a.type]));
      const [options, optionCount, optionId, buffer, display, mode, context, expectActions, keys, func] = steps[i];

      assertSameRanking(ime, options, where);
      assert.equal(ime.options.length, optionCount, `option count, ${where}`);
      assert.equal(ime.optionId, optionId, `option id, ${where}`);
      assert.equal(ime.buffer, buffer, `buffer, ${where}`);
      assert.equal(ime.bufferDisplay(), display, `buffer display, ${where}`);
      assert.equal(ime.mode, mode, `mode, ${where}`);
      assert.equal(ime.context, context, `context, ${where}`);
      assert.deepEqual(actions, expectActions, `actions, ${where}`);

      const labels = ime.labels();
      lastKeys = keys ?? lastKeys;
      assert.deepEqual(labels.keys, lastKeys, `key labels, ${where}`);
      assert.equal(labels.func, func, `func label, ${where}`);
    });
  }
});

test("parses the data files", () => {
  const freq = parseWords("the 127\nof 150\n");
  assert.deepEqual([...freq.keys()], ["the", "of"]);
  assert.ok(Math.abs(freq.get("the") - 10 ** -1.27) < 1e-15);
  const bigrams = parseNgrams("the cat 5 dog 2\n<s?> hi 1\n");
  assert.deepEqual([...bigrams.get("the")], [["cat", 5], ["dog", 2]]);
  assert.equal(bigrams.get("<s?>").get("hi"), 1);
});

test("bigram candidates outrank unigram-only ones of equal frequency", () => {
  const freq = new Map([["me", 0.001], ["of", 0.01], ["re", 0.001]]);
  const model = new Model(new Map([["for", new Map([["me", 55], ["of", 21]])]]), freq);
  const [me, of, re] = model.scoreCandidates("for", ["me", "of", "re"]);
  assert.ok(me > of, "bigram count decides between two bigram candidates");
  assert.equal(me, 55);
  // base = min(55/0.001, 21/0.01) = 2100, so "re" scores 2100 * 0.001 = 2.1.
  assert.ok(Math.abs(re - 2.1) < 1e-9);
});

test("falls back to unigram frequency when the history is unknown", () => {
  const freq = new Map([["a", 0.5], ["b", 0.25]]);
  const model = new Model(new Map(), freq);
  const [a, b] = model.scoreCandidates("zzz", ["a", "b"]);
  assert.ok(a > b);
});

test("the sentence start is the default history", () => {
  const freq = new Map([["the", 0.05], ["cat", 0.001]]);
  const model = new Model(new Map([["<s?>", new Map([["cat", 3]])]]), freq);
  const [the, cat] = model.scoreCandidates("", ["the", "cat"]);
  assert.equal(cat, 3);
  // base = 3 / 0.001 = 3000, so the unigram-only "the" scores 3000 * 0.05.
  assert.ok(Math.abs(the - 150) < 1e-9);
});

test("selectOption highlights an option directly, like pressing Select", () => {
  const ime = createIME(layout, words, ngrams);
  assert.equal(ime.selectOption(0), false, "no options yet");
  ["4", "2"].forEach((token) => ime.input(token)); // "hi", "his", ...
  assert.ok(ime.options.length > 2);
  assert.equal(ime.selectOption(2), true);
  assert.equal(ime.optionId, 2);
  const picked = ime.options[2];
  assert.deepEqual(ime.input("1").map((a) => a.text), [picked + " "], "the next key writes it");
  assert.equal(ime.selectOption(99), false);
  assert.equal(ime.selectOption(-1), false);
});

test("selectOption does nothing in function or symbol mode", () => {
  const ime = createIME(layout, words, ngrams);
  ime.input("F");
  assert.equal(ime.selectOption(0), false);
  ime.input("4"); // symbol mode
  assert.equal(ime.mode, "4");
  assert.equal(ime.selectOption(0), false);
});
