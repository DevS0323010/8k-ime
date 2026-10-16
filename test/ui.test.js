// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildKeyMap, resolveKey } from "../src/ui/keys.js";
import { applyAction, Output } from "../src/ui/text.js";

const bindings = JSON.parse(readFileSync(new URL("../src/layout/keybindings.json", import.meta.url), "utf8"));
const insert = (text) => ({ type: "insert", text });

test("insert appends", () => {
  assert.equal(applyAction("hello ", insert("world ")), "hello world ");
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
  assert.equal(out.text, "hello ");
  assert.equal(out.undo(), false, "undo only works once");
});

test("typing after Clear makes it permanent", () => {
  const out = new Output();
  out.apply([insert("old ")]);
  out.clear();
  out.apply([insert("new ")]);
  assert.equal(out.canUndo, false);
  assert.equal(out.undo(), false);
  assert.equal(out.text, "new ");
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
