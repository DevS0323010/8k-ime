// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import { DEFAULTS } from "./settings.js";

const SPEC = [
  {
    key: "textSize",
    legend: "Text size",
    options: [[1, "Normal"], [1.25, "Large"], [1.5, "Larger"], [2, "Largest"]],
  },
  {
    key: "theme",
    legend: "Colours",
    options: [["auto", "Automatic"], ["light", "Light"], ["dark", "Dark"], ["contrast", "High contrast"]],
  },
  {
    key: "screenFire",
    legend: "On-screen keys act when",
    note: "Released: slide your finger off a key to cancel it.",
    options: [["press", "Pressed"], ["release", "Released"]],
  },
  {
    key: "tapSuggestion",
    legend: "Tapping a suggestion",
    note: "Highlight: like Select, and the next key writes it. Write: the word is written at once.",
    options: [["select", "Highlights it"], ["write", "Writes it"]],
  },
  {
    key: "holdMs",
    legend: "Hold a key before it counts",
    note: "Brief accidental touches are then ignored. Applies to the keyboard too.",
    options: [[0, "Off"], [200, "0.2 s"], [400, "0.4 s"], [600, "0.6 s"], [1000, "1 s"]],
  },
];

/**
 * Builds the settings form inside `root`. `onChange(settings)` runs on every
 * change. Returns {sync(settings)} to bring the controls up to date.
 */
export function createSettingsPanel(root, settings, onChange) {
  let current = settings;
  const radios = []; // {input, key, value}
  const parts = [];

  for (const { key, legend, note, options } of SPEC) {
    const fieldset = document.createElement("fieldset");
    const title = document.createElement("legend");
    title.textContent = legend;
    fieldset.append(title);
    if (note) {
      const hint = document.createElement("p");
      hint.className = "note";
      hint.textContent = note;
      fieldset.append(hint);
    }
    const row = document.createElement("div");
    row.className = "choices";
    for (const [value, label] of options) {
      const choice = document.createElement("label");
      choice.className = "choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = key;
      input.addEventListener("change", () => {
        if (input.checked) onChange((current = { ...current, [key]: value }));
      });
      radios.push({ input, key, value });
      choice.append(input, label);
      row.append(choice);
    }
    fieldset.append(row);
    parts.push(fieldset);
  }

  const blinkLabel = document.createElement("label");
  blinkLabel.className = "choice wide";
  const blink = document.createElement("input");
  blink.type = "checkbox";
  blink.addEventListener("change", () => onChange((current = { ...current, blink: blink.checked })));
  blinkLabel.append(blink, "Blink the cursor");
  parts.push(blinkLabel);

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "plain";
  reset.textContent = "Reset to defaults";
  reset.addEventListener("click", () => {
    current = { ...DEFAULTS };
    sync(current);
    onChange(current);
  });
  parts.push(reset);
  root.replaceChildren(...parts);

  function sync(next) {
    current = next;
    for (const { input, key, value } of radios) input.checked = next[key] === value;
    blink.checked = next.blink;
  }
  sync(settings);
  return { sync };
}
