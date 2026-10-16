// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import { getCandidates } from "./candidates.js";

const CONTEXT_WORDS = 10;

/**
 * The input state machine. `input(token)` takes one of "1".."6", "S" or "F"
 * and returns the output actions it causes:
 *   { type: "insert", text }, { type: "deleteWord" }, { type: "backspace" }
 * Everything else the UI needs is read from the fields and the methods below.
 */
export class IME {
  /**
   * @param {{key_map, key_disp, key_disp_func, mode_lists}} layout
   * @param {import("./model.js").Model} model
   * @param {import("./candidates.js").Lexicon} lexicon
   */
  constructor(layout, model, lexicon) {
    this.layout = layout;
    this.model = model;
    this.lexicon = lexicon;
    this.buffer = "";
    this.context = "";
    this.options = [];
    this.optionScores = []; // score of each option, same order
    this.optionId = -1;
    this.mode = "0";
  }

  /**
   * Highlights option `index` directly, as if Select had been pressed until it
   * got there. Returns whether there was such an option to highlight.
   */
  selectOption(index) {
    if (this.mode !== "0" || this.buffer === "F" || !(index >= 0 && index < this.options.length)) {
      return false;
    }
    this.optionId = index;
    return true;
  }

  /** Back to a fresh start: no buffer, no context, normal mode. */
  reset() {
    this.buffer = "";
    this.context = "";
    this.#clearOptions();
    this.optionId = -1;
    this.mode = "0";
  }

  /** Looks up the options for the current buffer. */
  #refreshOptions() {
    const found = getCandidates(this.context, this.buffer, this.model, this.lexicon);
    this.options = found.map(([word]) => word);
    this.optionScores = found.map(([, score]) => score);
  }

  #clearOptions() {
    this.options = [];
    this.optionScores = [];
  }

  /** Takes a token, returns the list of output actions. */
  input(token) {
    const { key_map: keyMap, mode_lists: modeLists } = this.layout;
    const out = [];
    const insert = (text) => out.push({ type: "insert", text });
    this.context = this.context.split(" ").slice(-CONTEXT_WORDS).join(" ");

    if (token === "S") {
      if (this.mode === "0") {
        if (this.buffer === "F") {
          insert("\n");
          this.context = "";
          this.buffer = "";
        } else if (this.options.length > 0) {
          this.optionId = (this.optionId + 1) % this.options.length;
        }
      } else if (this.buffer === "") {
        this.mode = "0";
      } else {
        insert(this.#modeChar());
        this.buffer = "";
      }
    } else if (token in keyMap) {
      if (this.mode === "0") {
        if (this.buffer === "F") {
          this.buffer = "";
          if (token in modeLists) {
            this.optionId = -1;
            this.#clearOptions();
            this.context = "";
            this.mode = token;
          }
          return out;
        }
        this.#commitOption(insert);
        this.buffer += token;
        this.optionId = -1;
        this.#refreshOptions();
      } else if (this.buffer.length === 0 || this.buffer.at(-1) === token) {
        this.buffer += token;
      } else {
        insert(this.#modeChar());
        this.buffer = token;
      }
    } else if (token === "F") {
      if (this.mode === "0") {
        this.#commitOption(insert);
        if (this.buffer === "F") {
          this.context = this.context.split(" ").slice(0, -1).join(" ");
          out.push({ type: "deleteWord" });
          this.buffer = "";
        } else if (this.buffer.length > 0) {
          this.buffer = this.buffer.slice(0, -1);
          this.#refreshOptions();
        } else {
          this.buffer = "F";
          this.#clearOptions();
        }
      } else if (this.buffer.length > 0) {
        this.buffer = "";
      } else {
        out.push({ type: "backspace" });
      }
    }
    return out;
  }

  /** If an option is highlighted, writes it out and clears the buffer. */
  #commitOption(insert) {
    if (this.optionId < 0) return;
    const word = this.options[this.optionId];
    this.context += " " + word;
    insert(word + " ");
    this.buffer = "";
    this.optionId = -1;
    this.#clearOptions();
  }

  /** The character a symbol-mode buffer currently stands for. */
  #modeChar() {
    const chars = this.layout.mode_lists[this.mode][this.buffer[0]];
    return chars[(this.buffer.length - 1) % chars.length];
  }

  /** What to show on the buffer line. */
  bufferDisplay() {
    if (this.mode === "0") {
      return this.buffer
        .replaceAll("1", "A")
        .replaceAll("6", "E")
        .replaceAll("2", "I")
        .replaceAll("5", "O")
        .replaceAll("3", "U")
        .replaceAll("4", "Z");
    }
    return this.buffer.length > 0 ? this.#modeChar() : "";
  }

  /**
   * Labels for the six letter keys (in key_disp order), the F key and the S key.
   * Select writes a new line in the function menu, and leaves a symbol mode
   * when nothing is waiting to be accepted.
   */
  labels() {
    const { key_disp: keyDisp, key_disp_func: keyDispFunc, mode_lists: modeLists } = this.layout;
    const keys = keyDisp.map(([token, label], i) => {
      if (this.mode !== "0") return modeLists[this.mode][token].join(" ");
      return this.buffer === "F" ? keyDispFunc[i][1] : label;
    });
    const back = (this.buffer.length > 0 && this.optionId === -1) || this.mode !== "0";
    let select = "Select";
    if (this.mode === "0") {
      if (this.buffer === "F") select = "↵";
    } else if (this.buffer === "") {
      select = "Exit";
    }
    return { keys, func: back ? "<<" : "Func", select };
  }
}
