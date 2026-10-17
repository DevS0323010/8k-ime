// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010
//
// Turns the IME's output actions into text, with a few simple typographic
// rules (no language model):
//
//   Spacing    Words come in with a trailing space. . , ; : ! ? ) ] attach to
//              the word before them and are followed by a space; ( [ and an
//              opening quote are not; a hyphen joins both sides; + has spaces
//              around it; a digit after "3. " or "3, " closes the gap (3.5).
//   Capitals   The first word of the text, of a line and of a sentence (after
//              . ! ?) starts with a capital; "i" and "i'm" become "I", "I'm".
//   Quotes     A " is a closing quote if an odd number is open on the line. A ' is
//              left as it is: no pairing and no special spacing.

const WORD = /^\p{L}[\p{L}']* $/u; // a committed word: letters, apostrophes, one trailing space
const CLOSERS = ".,;:!?)]";

const trimEnd = (text) => text.replace(/ +$/, "");

/** Whether a space has to be added before the next word or opening mark. */
const needsSpace = (text) => text !== "" && !/[\s(["-]$/.test(text);

/** Whether the next letter starts a sentence or a line. */
export function capitalizeNext(text) {
  return (
    /(^|\n)[ \t]*["([]*$/.test(text) || /[.!?][")\]]*\s+["([]*$/.test(text)
  );
}

/** A word as it will appear if it is written after `text`. */
export function formatWord(word, text) {
  if (word === "i" || word.startsWith("i'")) return "I" + word.slice(1);
  return capitalizeNext(text) ? word[0].toUpperCase() + word.slice(1) : word;
}

/** Whether an odd number of double quotes is open on the current line. */
function inQuote(text) {
  const line = text.slice(text.lastIndexOf("\n") + 1);
  return (line.match(/"/g)?.length ?? 0) % 2 === 1;
}

function insertText(text, s) {
  if (s === "\n") return trimEnd(text) + "\n";
  if (WORD.test(s)) {
    return text + (needsSpace(text) ? " " : "") + formatWord(s.slice(0, -1), text) + " ";
  }
  if (/^\p{L}$/u.test(s)) return text + (capitalizeNext(text) ? s.toUpperCase() : s);
  if (/^\d$/.test(s)) return (/\d[.,:] $/.test(text) ? text.slice(0, -1) : text) + s;
  if (s.length === 1 && CLOSERS.includes(s)) return trimEnd(text) + s + " ";
  if (s === "(" || s === "[") return text + (needsSpace(text) ? " " : "") + s;
  if (s === '"') {
    if (inQuote(text)) return trimEnd(text) + s + " ";
    return text + (needsSpace(text) ? " " : "") + s;
  }
  if (s === "-") return trimEnd(text) + "-";
  if (s === "+") return (text === "" || text.endsWith("\n") ? text : trimEnd(text) + " ") + "+ ";
  return text + s;
}

/**
 * How `word` would be added after `text`: {gap, word}, where gap is the space
 * written before it (if any) and word has its capitals applied. The space after
 * it is left out. Used to preview the word before it is written.
 */
export function previewWord(text, word) {
  const full = insertText(text, word + " ");
  if (!full.startsWith(text)) return null;
  const added = full.slice(text.length);
  const gap = added.startsWith(" ") ? " " : "";
  return { gap, word: added.slice(gap.length).trimEnd() };
}

/** Applies one IME output action to a string. */
export function applyAction(text, action) {
  switch (action.type) {
    case "insert":
      return insertText(text, action.text);
    case "deleteWord":
      // Like Ctrl+Backspace: the last word and the whitespace after it.
      return text.replace(/\S+\s*$/, "").replace(/^\s+$/, "");
    case "backspace":
      return Array.from(text).slice(0, -1).join("");
    default:
      throw new Error(`Unknown action ${action.type}`);
  }
}

const TRAIL_LIMIT = 100;

/** The text written so far, with Clear and Undo. No DOM. */
export class Output {
  constructor() {
    this.text = "";
    this.cleared = null; // text removed by the last Clear, until something changes it
    this.trail = []; // {before, after} of recent insertions, so backspace can undo one whole
  }

  get canUndo() {
    return this.cleared !== null;
  }

  apply(actions) {
    const before = this.text;
    for (const action of actions) {
      const previous = this.text;
      if (action.type === "backspace") {
        // Take back the last insertion whole, so removing a "." also gives back the space it ate.
        const last = this.trail.at(-1);
        if (last && last.after === previous) {
          this.text = last.before;
          this.trail.pop();
        } else {
          this.text = applyAction(previous, action);
        }
      } else {
        this.text = applyAction(previous, action);
        if (action.type === "insert") {
          this.trail.push({ before: previous, after: this.text });
          if (this.trail.length > TRAIL_LIMIT) this.trail.shift();
        }
      }
    }
    if (this.text !== before) this.cleared = null;
  }

  /** Empties the text; returns false if there was nothing to clear. */
  clear() {
    if (this.text === "") return false;
    this.cleared = this.text;
    this.text = "";
    this.trail = [];
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
