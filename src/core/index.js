// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import { Lexicon } from "./candidates.js";
import { IME } from "./ime.js";
import { Model, parseNgrams, parseWords } from "./model.js";

export { IME, Lexicon, Model };

/** Builds an IME from the layout object and the text of the two data files. */
export function createIME(layout, wordsText, ngramText) {
  const freq = parseWords(wordsText);
  const model = new Model(parseNgrams(ngramText), freq);
  return new IME(layout, model, new Lexicon(freq, layout.key_map));
}
