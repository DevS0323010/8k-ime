// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const layout = read("../src/layout/en.json");
const { tokens, actions } = read("../src/layout/keybindings.json");

test("every token has main-keyboard keys", () => {
  const expected = [...Object.keys(layout.key_map), "S", "F"].sort();
  assert.deepEqual(Object.keys(tokens).sort(), expected);
  for (const [token, { main }] of Object.entries(tokens)) {
    assert.ok(main.length >= 6, `token ${token} has ${main.length} main keys`);
  }
});

test("no key code is bound twice", () => {
  const seen = new Map();
  const bind = (code, owner) => {
    assert.ok(!seen.has(code), `${code} is bound to both ${seen.get(code)} and ${owner}`);
    seen.set(code, owner);
  };
  for (const [token, { main, numpad }] of Object.entries(tokens)) {
    [...main, ...numpad].forEach((code) => bind(code, `token ${token}`));
  }
  for (const [action, codes] of Object.entries(actions)) {
    codes.forEach((code) => bind(code, `action ${action}`));
  }
});

test("numpad codes are numpad keys and main codes are not", () => {
  for (const { main, numpad } of Object.values(tokens)) {
    numpad.forEach((code) => assert.match(code, /^Numpad/));
    main.forEach((code) => assert.doesNotMatch(code, /^Numpad/));
  }
});
