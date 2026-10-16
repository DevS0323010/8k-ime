// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

/**
 * The on-screen keys: the six letter keys in two rows of three, with Func and
 * Select in a fourth column, as in the prototype's window. Fires on pointerdown
 * so touches have no delay, and never takes focus.
 */
export function createKeypad(root, layout, onToken) {
  const buttons = new Map();

  function addButton(token, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `key ${className}`;
    button.dataset.token = token;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault(); // no focus change, no text selection, no ghost click
      onToken(token);
    });
    // Keyboard activation (Enter or Space on a focused button) arrives as a click with detail 0.
    button.addEventListener("click", (event) => {
      if (event.detail === 0) onToken(token);
    });
    buttons.set(token, button);
    return button;
  }

  const letterKeys = layout.key_disp.map(([token]) => addButton(token, "letter"));
  const funcKey = addButton("F", "func");
  const selectKey = addButton("S", "select");
  selectKey.textContent = "Select";
  // Grid areas: three letter keys per row, Func over Select in the last column.
  root.replaceChildren(...letterKeys, funcKey, selectKey);

  function render(ime) {
    const { keys, func } = ime.labels();
    letterKeys.forEach((button, i) => (button.textContent = keys[i]));
    funcKey.textContent = func;
  }

  /** Briefly marks the key for a token, so physical key presses show on screen. */
  function flash(token) {
    const button = buttons.get(token);
    if (!button) return;
    button.classList.add("pressed");
    setTimeout(() => button.classList.remove("pressed"), 120);
  }

  return { render, flash };
}
