// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

function filesUnder(dir) {
  return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(`${dir}${entry.name}/`) : [`${dir}${entry.name}`],
  );
}

function precacheList() {
  const source = readFileSync(new URL("sw.js", root), "utf8");
  const list = source.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1];
  return JSON.parse(list.replace(/,\s*\]$/, "]"));
}

test("the service worker precaches exactly the files the page uses", () => {
  const expected = [
    "./",
    "index.html",
    "manifest.webmanifest",
    ...filesUnder("icons/"),
    ...filesUnder("src/"),
    "data/keymap_words.txt",
    "data/ngram_model.txt",
  ].sort();
  assert.deepEqual(precacheList().sort(), expected);
});

test("every precached file exists", () => {
  for (const path of precacheList()) {
    assert.ok(existsSync(new URL(path === "./" ? "index.html" : path, root)), `${path} is missing`);
  }
});

test("the manifest icons exist", () => {
  const { icons } = JSON.parse(readFileSync(new URL("manifest.webmanifest", root), "utf8"));
  for (const { src } of icons) assert.ok(existsSync(new URL(src, root)), `${src} is missing`);
});
