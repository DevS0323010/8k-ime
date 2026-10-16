// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import { bindPress } from "./touch.js";

const SLOTS = 4;

/**
 * The buffer line and the strip of candidate words. Tapping a candidate
 * highlights it, as if Select had been pressed until it got there. The strip
 * is shared with the Copy, Clear, Help and Settings buttons: the candidates
 * show while there are any, the buttons otherwise.
 */
export function createStatus({ bufferEl, modeEl, candidatesEl, stripEl, announceEl }, layout, handlers) {
  const slots = Array.from({ length: SLOTS }, () => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "candidate";
    slot.tabIndex = -1;
    bindPress(slot, () => (slot.dataset.index ? { type: "pick", index: Number(slot.dataset.index) } : null), handlers);
    return slot;
  });
  candidatesEl.replaceChildren(...slots);
  const modeNames = new Map(layout.key_disp_func);

  /** `format` maps a candidate to how it will appear in the output (capitals). */
  function render(ime, format = (word) => word) {
    bufferEl.textContent = ime.bufferDisplay();
    modeEl.textContent = ime.mode === "0" ? "" : modeNames.get(ime.mode);
    modeEl.hidden = ime.mode === "0";

    // Show the page of four that contains the highlighted option.
    const offset = Math.max(0, Math.floor(ime.optionId / SLOTS) * SLOTS);
    slots.forEach((slot, i) => {
      const word = ime.options[offset + i];
      slot.textContent = word === undefined ? "–" : format(word);
      slot.classList.toggle("empty", word === undefined);
      slot.classList.toggle("selected", ime.optionId >= 0 && offset + i === ime.optionId);
      if (word === undefined) delete slot.dataset.index;
      else slot.dataset.index = String(offset + i);
    });
    stripEl.classList.toggle("has-candidates", ime.options.length > 0);
    if (announceEl) announceEl.textContent = ime.optionId >= 0 ? format(ime.options[ime.optionId]) : "";
  }

  return { render };
}
