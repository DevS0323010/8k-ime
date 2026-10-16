// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildKeyMap, resolveKey } from "../src/ui/keys.js";
import { applyAction, capitalizeNext, formatWord, Output } from "../src/ui/text.js";

const bindings = JSON.parse(readFileSync(new URL("../src/layout/keybindings.json", import.meta.url), "utf8"));
const insert = (text) => ({ type: "insert", text });

/** Writes the pieces one after another, as the IME would, and returns the text. */
function write(...pieces) {
  const out = new Output();
  out.apply(pieces.map(insert));
  return out.text;
}

test("insert appends", () => {
  assert.equal(applyAction("hello ", insert("world ")), "hello world ");
});

test("the first word of the text is capitalized", () => {
  assert.equal(write("hello "), "Hello ");
  assert.equal(write("hello ", "world "), "Hello world ");
});

test("punctuation attaches to the word before it and is followed by a space", () => {
  assert.equal(write("hello ", ",", "world ", "."), "Hello, world. ");
  assert.equal(write("really ", "?", "!"), "Really?! ");
  assert.equal(write("wait ", ".", ".", "."), "Wait... ");
  assert.equal(write("a ", ":", "b ", ";"), "A: b; ");
});

test("a sentence starts with a capital after . ! ?", () => {
  assert.equal(write("hi ", ".", "it ", "works ", "!", "yes "), "Hi. It works! Yes ");
  assert.equal(write("so ", ",", "yes "), "So, yes ");
});

test("a new line starts with a capital and loses trailing spaces before it", () => {
  assert.equal(write("hello ", "\n", "again "), "Hello\nAgain ");
});

test("i becomes I, with contractions", () => {
  assert.equal(write("so ", "i ", "think "), "So I think ");
  assert.equal(write("so ", "i'm ", "sure "), "So I'm sure ");
  assert.equal(write("it ", "is ", "in "), "It is in ");
});

test("brackets and quotes", () => {
  assert.equal(write("see ", "(", "below ", ")", "."), "See (below). ");
  assert.equal(write("he ", "said ", '"', "go ", '"', "."), 'He said "go". ');
  assert.equal(write("he ", "said ", "'", "go ", "'", "."), "He said 'go'. ");
  assert.equal(write("it ", "is ", "don't "), "It is don't ");
  assert.equal(write("so ", ".", '"', "yes ", '"'), 'So. "Yes" ');
});

test("a quote opened after a sentence end still capitalizes the word", () => {
  assert.equal(write("no ", ".", '"', "yes "), 'No. "Yes ');
});

test("hyphens join words and plus has spaces around it", () => {
  assert.equal(write("well ", "-", "known "), "Well-known ");
  assert.equal(write("1", "+", "2"), "1 + 2");
});

test("numbers: digits join, decimals close the gap, a word after digits gets a space", () => {
  assert.equal(write("it ", "costs ", "1", "2"), "It costs 12");
  assert.equal(write("pi ", "is ", "3", ".", "1", "4"), "Pi is 3.14");
  assert.equal(write("at ", "1", "0", ":", "3", "0"), "At 10:30");
  assert.equal(write("in ", "2", "0", "2", "0", "words "), "In 2020 words ");
  assert.equal(write("1", ".", "yes "), "1. Yes ");
});

test("single letters from abc mode follow the same capital rule but join up", () => {
  assert.equal(write("a", "b", "c"), "Abc");
  assert.equal(write("see ", "a", "b"), "See ab");
  assert.equal(write("see ", ".", "a", "b"), "See. Ab");
});

test("capitalizeNext and formatWord", () => {
  assert.equal(capitalizeNext(""), true);
  assert.equal(capitalizeNext("Hi. "), true);
  assert.equal(capitalizeNext('Hi." '), true);
  assert.equal(capitalizeNext("Hi, "), false);
  assert.equal(capitalizeNext("Hi\n"), true);
  assert.equal(capitalizeNext("3.5 "), false);
  assert.equal(formatWord("cat", "Hi. "), "Cat");
  assert.equal(formatWord("cat", "Hi, "), "cat");
  assert.equal(formatWord("i", "Hi, "), "I");
});

test("backspace takes back the last insertion whole, giving the space back", () => {
  const out = new Output();
  out.apply([insert("hello "), insert(".")]);
  assert.equal(out.text, "Hello. ");
  out.apply([{ type: "backspace" }]);
  assert.equal(out.text, "Hello ");
  out.apply([insert("1"), insert("2"), { type: "backspace" }]);
  assert.equal(out.text, "Hello 1");
});

test("backspace falls back to deleting a character when the text moved on", () => {
  const out = new Output();
  out.apply([insert("hello "), { type: "deleteWord" }, insert("a"), insert("b")]);
  assert.equal(out.text, "Ab");
  out.apply([{ type: "backspace" }, { type: "backspace" }, { type: "backspace" }]);
  assert.equal(out.text, "");
});

test("deleteWord removes the last word and the space after it", () => {
  const del = { type: "deleteWord" };
  assert.equal(applyAction("one two ", del), "one ");
  assert.equal(applyAction("one two", del), "one ");
  assert.equal(applyAction("one ", del), "");
  assert.equal(applyAction("one\n", del), "");
  assert.equal(applyAction("   ", del), "");
  assert.equal(applyAction("", del), "");
});

test("backspace removes one character, not half a surrogate pair", () => {
  assert.equal(applyAction("abc", { type: "backspace" }), "ab");
  assert.equal(applyAction("a😀", { type: "backspace" }), "a");
  assert.equal(applyAction("", { type: "backspace" }), "");
});

test("unknown actions are an error", () => {
  assert.throws(() => applyAction("", { type: "nope" }));
});

test("Output clears and undoes", () => {
  const out = new Output();
  assert.equal(out.clear(), false, "nothing to clear");
  out.apply([insert("hello ")]);
  assert.equal(out.clear(), true);
  assert.equal(out.text, "");
  assert.ok(out.canUndo);
  assert.equal(out.undo(), true);
  assert.equal(out.text, "Hello ");
  assert.equal(out.undo(), false, "undo only works once");
});

test("typing after Clear makes it permanent", () => {
  const out = new Output();
  out.apply([insert("old ")]);
  out.clear();
  out.apply([insert("new ")]);
  assert.equal(out.canUndo, false);
  assert.equal(out.undo(), false);
  assert.equal(out.text, "New ");
});

test("an action that changes nothing keeps Undo available", () => {
  const out = new Output();
  out.apply([insert("x")]);
  out.clear();
  out.apply([{ type: "backspace" }]); // nothing left to delete
  assert.ok(out.canUndo);
});

test("discardUndo makes Clear permanent", () => {
  const out = new Output();
  out.apply([insert("x")]);
  out.clear();
  out.discardUndo();
  assert.equal(out.undo(), false);
});

test("keys resolve by physical code", () => {
  const map = buildKeyMap(bindings);
  const at = (code, extra = {}) => resolveKey({ code, ctrlKey: false, altKey: false, metaKey: false, repeat: false, ...extra }, map);
  assert.deepEqual(at("KeyQ"), { type: "token", token: "1", repeat: false });
  assert.deepEqual(at("Numpad4"), { type: "token", token: "1", repeat: false });
  assert.deepEqual(at("Space"), { type: "token", token: "S", repeat: false });
  assert.deepEqual(at("Backspace"), { type: "token", token: "F", repeat: false });
  assert.deepEqual(at("Backquote"), { type: "action", action: "copy", repeat: false });
  assert.deepEqual(at("Escape"), { type: "action", action: "clear", repeat: false });
  assert.equal(at("KeyQ", { repeat: true }).repeat, true);
  assert.equal(at("Tab"), null, "Tab is left for keyboard navigation");
  assert.equal(at("F5"), null);
});

test("Ctrl, Alt and Meta combinations are left to the browser", () => {
  const map = buildKeyMap(bindings);
  for (const mod of ["ctrlKey", "altKey", "metaKey"]) {
    assert.equal(resolveKey({ code: "KeyQ", repeat: false, [mod]: true }, map), null);
  }
  assert.notEqual(resolveKey({ code: "KeyQ", repeat: false, shiftKey: true }, map), null, "Shift is allowed");
});
