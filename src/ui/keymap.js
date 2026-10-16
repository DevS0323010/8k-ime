// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

// ANSI keyboard rows by physical key code.
const ROWS = [
  ["Escape"],
  ["Backquote", ..."1234567890".split("").map((d) => `Digit${d}`), "Minus", "Equal", "Backspace"],
  [..."QWERTYUIOP".split("").map((c) => `Key${c}`), "BracketLeft", "BracketRight", "Backslash"],
  [..."ASDFGHJKL".split("").map((c) => `Key${c}`), "Semicolon", "Quote", "Enter"],
  [..."ZXCVBNM".split("").map((c) => `Key${c}`), "Comma", "Period", "Slash", "ShiftRight"],
  ["Space"],
];

const NAMES = {
  Escape: "Esc", Backquote: "`", Minus: "-", Equal: "=", Backspace: "⌫",
  BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'",
  Enter: "⏎", Comma: ",", Period: ".", Slash: "/", ShiftRight: "⇧", Space: "␣",
};

const keyName = (code) => NAMES[code] ?? code.replace(/^(Digit|Key)/, "");

/**
 * A picture of the keyboard with each key tinted by the chunk it belongs to,
 * drawn from the same bindings the keyboard handler uses, plus a legend.
 */
export function createKeymap(root, bindings, layout) {
  const chunkOf = new Map(); // code -> {chunk, title}
  const labels = new Map(layout.key_disp);
  labels.set("S", "Select");
  labels.set("F", "Func");
  for (const [token, { main }] of Object.entries(bindings.tokens)) {
    for (const code of main) chunkOf.set(code, { chunk: token, title: labels.get(token) });
  }
  const copy = bindings.actions.copy;
  const clear = bindings.actions.clear;
  for (const code of copy) chunkOf.set(code, { chunk: "copy", title: "Copy" });
  for (const code of clear) chunkOf.set(code, { chunk: "clear", title: "Clear" });

  const board = document.createElement("div");
  board.className = "board";
  for (const row of ROWS) {
    const rowEl = document.createElement("div");
    rowEl.className = "board-row";
    for (const code of row) {
      const key = document.createElement("span");
      key.className = "board-key";
      key.textContent = keyName(code);
      const hit = chunkOf.get(code);
      if (hit) {
        key.dataset.chunk = hit.chunk;
        key.title = hit.title;
      }
      if (code === "Space") key.classList.add("wide");
      rowEl.append(key);
    }
    board.append(rowEl);
  }

  const legend = document.createElement("ul");
  legend.className = "legend";
  const order = [...layout.key_disp.map(([token]) => token), "F", "S", "copy", "clear"];
  const names = { ...Object.fromEntries(labels), copy: "Copy output", clear: "Clear output" };
  for (const chunk of order) {
    const item = document.createElement("li");
    item.dataset.chunk = chunk;
    item.textContent = names[chunk];
    legend.append(item);
  }
  root.replaceChildren(board, legend);
}
