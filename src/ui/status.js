// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

const SLOTS = 4;

/** The buffer line and the strip of candidate words. */
export function createStatus({ bufferEl, modeEl, candidatesEl }, layout) {
  const slots = Array.from({ length: SLOTS }, () => {
    const slot = document.createElement("span");
    slot.className = "candidate";
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
    });
  }

  return { render };
}
