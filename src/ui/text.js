// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

/** Applies one IME output action to a string. */
export function applyAction(text, action) {
  switch (action.type) {
    case "insert":
      return text + action.text;
    case "deleteWord":
      // Like Ctrl+Backspace: the last word and the whitespace after it.
      return text.replace(/\S+\s*$/, "").replace(/^\s+$/, "");
    case "backspace":
      return Array.from(text).slice(0, -1).join("");
    default:
      throw new Error(`Unknown action ${action.type}`);
  }
}

/** The text written so far, with Clear and Undo. No DOM. */
export class Output {
  constructor() {
    this.text = "";
    this.cleared = null; // text removed by the last Clear, until something changes it
  }

  get canUndo() {
    return this.cleared !== null;
  }

  apply(actions) {
    const before = this.text;
    for (const action of actions) this.text = applyAction(this.text, action);
    if (this.text !== before) this.cleared = null;
  }

  /** Empties the text; returns false if there was nothing to clear. */
  clear() {
    if (this.text === "") return false;
    this.cleared = this.text;
    this.text = "";
    return true;
  }

  /** Restores the text removed by Clear; returns false if there is nothing to restore. */
  undo() {
    if (this.cleared === null) return false;
    this.text = this.cleared;
    this.cleared = null;
    return true;
  }

  /** Makes the last Clear permanent. */
  discardUndo() {
    this.cleared = null;
  }
}
