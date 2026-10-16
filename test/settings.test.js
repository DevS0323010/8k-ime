// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import assert from "node:assert/strict";
import { test } from "node:test";

import { CHOICES, DEFAULTS, loadSettings, normalize, saveSettings } from "../src/ui/settings.js";

test("every default is one of its allowed choices", () => {
  for (const [key, allowed] of Object.entries(CHOICES)) {
    assert.ok(allowed.includes(DEFAULTS[key]), key);
  }
});

test("normalize keeps allowed values and replaces the rest with defaults", () => {
  assert.deepEqual(normalize({ textSize: 1.5, theme: "dark", holdMs: 400, blink: true }), {
    ...DEFAULTS,
    textSize: 1.5,
    theme: "dark",
    holdMs: 400,
    blink: true,
  });
  assert.deepEqual(normalize({ textSize: 7, theme: "neon", holdMs: "400", blink: "yes" }), DEFAULTS);
  assert.deepEqual(normalize(null), DEFAULTS);
  assert.deepEqual(normalize("junk"), DEFAULTS);
});

test("settings survive a save and a load", () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const settings = { ...DEFAULTS, textSize: 2, screenFire: "press", holdMs: 600 };
  saveSettings(storage, settings);
  assert.deepEqual(loadSettings(storage), settings);
});

test("loading copes with missing, broken or blocked storage", () => {
  assert.deepEqual(loadSettings({ getItem: () => null }), DEFAULTS);
  assert.deepEqual(loadSettings({ getItem: () => "{not json" }), DEFAULTS);
  assert.deepEqual(loadSettings({ getItem: () => { throw new Error("blocked"); } }), DEFAULTS);
  assert.doesNotThrow(() => saveSettings({ setItem: () => { throw new Error("blocked"); } }, DEFAULTS));
});
