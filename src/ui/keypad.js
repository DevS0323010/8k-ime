// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import { bindPress } from "./touch.js";

/**
 * The on-screen keys: the six letter keys in two rows of three, with Func and
 * Select in a fourth column, as in the prototype's window.
 */
export function createKeypad(root, layout, handlers) {
  const buttons = new Map();

  function addButton(token, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `key ${className}`;
    button.dataset.token = token;
    bindPress(button, () => ({ type: "token", token }), handlers);
    buttons.set(token, button);
    return button;
  }

  const letterKeys = layout.key_disp.map(([token]) => addButton(token, "letter"));
  const funcKey = addButton("F", "func");
  const selectKey = addButton("S", "select");
  root.replaceChildren(...letterKeys, funcKey, selectKey);

  const spoken = { "↵": "New line" }; // for screen readers, where the symbol alone says nothing

  function render(ime) {
    const { keys, func, select } = ime.labels();
    letterKeys.forEach((button, i) => (button.textContent = keys[i]));
    funcKey.textContent = func;
    selectKey.textContent = select;
    selectKey.setAttribute("aria-label", spoken[select] ?? select);

    // In a symbol mode, mark the key the character being chosen is on, so that
    // after looking away it is clear where you left off.
    const current = ime.mode !== "0" && ime.buffer !== "" ? ime.buffer[0] : null;
    for (const button of letterKeys) {
      const here = button.dataset.token === current;
      button.classList.toggle("current", here);
      if (here) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
  }

  /** Briefly marks the key for a token, so physical key presses show on screen. */
  function flash(token) {
    const button = buttons.get(token);
    if (!button) return;
    button.classList.add("pressed");
    setTimeout(() => button.classList.remove("pressed"), 160);
  }

  /** Shows a fill running along the key while it has to be held. */
  function hold(token, ms) {
    const button = buttons.get(token);
    if (!button) return;
    button.style.setProperty("--hold-ms", `${ms}ms`);
    button.classList.remove("holding");
    void button.offsetWidth; // restarts the animation
    button.classList.add("holding");
  }

  function endHold(token) {
    buttons.get(token)?.classList.remove("holding");
  }

  return { render, flash, hold, endHold };
}
