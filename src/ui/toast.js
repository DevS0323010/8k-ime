// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

/** A short message at the bottom, optionally with one action button. */
export function createToast(root) {
  let timer = null;
  let onExpire = null;

  function hide() {
    clearTimeout(timer);
    timer = null;
    root.hidden = true;
    root.replaceChildren();
    const done = onExpire;
    onExpire = null;
    done?.();
  }

  /**
   * @param {string} message
   * @param {{actionLabel?: string, onAction?: () => void, onExpire?: () => void, ms?: number}} [options]
   *   onExpire runs when the toast goes away without its action being used.
   */
  function show(message, { actionLabel, onAction, onExpire: expire, ms = 2000 } = {}) {
    if (timer !== null) hide();
    root.replaceChildren(message);
    onExpire = expire ?? null;
    if (actionLabel) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = actionLabel;
      button.addEventListener("click", () => {
        onExpire = null;
        hide();
        onAction?.();
      });
      root.append(button);
    }
    root.hidden = false;
    timer = setTimeout(hide, ms);
  }

  return { show, hide };
}
