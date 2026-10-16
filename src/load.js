// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

async function fetchOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response;
}

/** Fetches the layout, key bindings and the two data files, relative to the page. */
export async function loadAll() {
  const [layout, bindings, words, ngrams] = await Promise.all([
    fetchOk("./src/layout/en.json").then((r) => r.json()),
    fetchOk("./src/layout/keybindings.json").then((r) => r.json()),
    fetchOk("./data/keymap_words.txt").then((r) => r.text()),
    fetchOk("./data/ngram_model.txt").then((r) => r.text()),
  ]);
  return { layout, bindings, words, ngrams };
}
