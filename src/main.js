// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import { createIME } from "./core/index.js";
import { loadAll } from "./load.js";
import { copyText } from "./ui/clipboard.js";
import { buildKeyMap, resolveKey } from "./ui/keys.js";
import { createKeymap } from "./ui/keymap.js";
import { createKeypad } from "./ui/keypad.js";
import { createSettingsPanel } from "./ui/panel.js";
import { PressGate } from "./ui/press.js";
import { applySettings, loadSettings, saveSettings } from "./ui/settings.js";
import { createStatus } from "./ui/status.js";
import { formatWord, Output, previewInsertion } from "./ui/text.js";
import { createToast } from "./ui/toast.js";

const UNDO_MS = 6000;
const $ = (id) => document.getElementById(id);

function storage() {
  try {
    return localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} }; // blocked: settings last until the page closes
  }
}

/** Opens a dialog; a click on its backdrop closes it. */
function wireDialog(dialog, openButton) {
  openButton.addEventListener("click", () => {
    dialog.showModal();
    dialog.scrollTop = 0; // focus lands on the Close button at the bottom
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

async function main() {
  const settings = { current: loadSettings(storage()) };
  applySettings(settings.current);

  const loading = $("loading");
  let data;
  try {
    data = await loadAll();
  } catch (error) {
    loading.textContent = `Could not load the dictionary: ${error.message}`;
    loading.classList.add("error");
    return;
  }

  const ime = createIME(data.layout, data.words, data.ngrams);
  const output = new Output();
  const toast = createToast($("toast"));
  let undoToastShown = false;
  const outputEl = $("output");

  // --- what a press does ---
  function press(token) {
    output.apply(ime.input(token));
    render();
  }

  function pick(index) {
    if (settings.current.tapSuggestion === "write") output.apply(ime.commitOption(index));
    else ime.selectOption(index);
    render();
  }

  async function copy() {
    if (output.text === "") return;
    toast.show((await copyText(output.text)) ? "Copied" : "Could not copy. Select the text and press Ctrl+C.");
  }

  function clear() {
    if (!output.clear()) return;
    ime.reset();
    undoToastShown = true;
    toast.show("Cleared", {
      actionLabel: "Undo",
      ms: UNDO_MS,
      onAction: undo,
      onExpire: () => {
        undoToastShown = false;
        output.discardUndo();
      },
    });
    render();
  }

  function undo() {
    undoToastShown = false;
    output.undo();
    render();
  }

  function perform(hit) {
    if (hit.type === "token") {
      keypad.flash(hit.token);
      press(hit.token);
    } else if (hit.type === "pick") {
      pick(hit.index);
    } else if (hit.action === "copy") {
      copy();
    } else if (hit.action === "clear") {
      clear();
    }
  }

  // --- the gate between presses and what they do ---
  const gate = new PressGate({
    fire: perform,
    onHoldStart: (hit, ms) => hit.type === "token" && keypad.hold(hit.token, ms),
    onHoldEnd: (hit) => hit.type === "token" && keypad.endHold(hit.token),
  });
  gate.configure(settings.current);

  const screen = {
    onDown: (id, hit) => gate.press(id, hit, { onRelease: settings.current.screenFire === "release" }),
    onUp: (id) => gate.release(id),
    onCancel: (id) => gate.cancel(id),
    onClick: perform,
  };

  const keypad = createKeypad($("keypad"), data.layout, screen);
  const status = createStatus(
    {
      bufferEl: $("buffer"),
      modeEl: $("mode"),
      candidatesEl: $("candidates"),
      stripEl: $("strip"),
      announceEl: $("announce"),
    },
    data.layout,
    screen,
  );

  /**
   * What would be written next, if the preview is on and there is something: the
   * highlighted word (the first if none is), or the character a symbol mode
   * currently stands for.
   */
  function pending() {
    if (!settings.current.preview) return null;
    const { options, optionId, mode, buffer } = ime;
    if (mode === "0") {
      if (buffer === "F" || options.length === 0) return null;
      return previewInsertion(output.text, options[Math.max(optionId, 0)] + " ");
    }
    const character = ime.bufferDisplay();
    return character ? previewInsertion(output.text, character) : null;
  }

  function renderOutput() {
    const next = pending();
    if (!next) {
      outputEl.textContent = output.text;
      return;
    }
    const mark = document.createElement("span");
    mark.className = "pending";
    mark.textContent = next.pending;
    outputEl.replaceChildren(next.before, mark);
  }

  function render() {
    renderOutput();
    outputEl.scrollTop = outputEl.scrollHeight;
    status.render(ime, (word) => formatWord(word, output.text));
    keypad.render(ime);
    $("copy").disabled = $("clear").disabled = output.text === "";
    if (undoToastShown && !output.canUndo) toast.hide();
  }

  // --- physical keyboard ---
  const keyMap = buildKeyMap(data.bindings);

  document.addEventListener("keydown", (event) => {
    if (document.querySelector("dialog[open]")) return; // Esc closes the dialog, nothing types
    if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;

    // Ctrl+Z / Cmd+Z takes back a Clear while its Undo button is showing.
    if ((event.ctrlKey || event.metaKey) && event.code === "KeyZ" && output.canUndo) {
      event.preventDefault();
      undo();
      toast.hide();
      return;
    }

    const hit = resolveKey(event, keyMap);
    if (!hit) return;
    event.preventDefault(); // no page scroll, no button activation, no find-as-you-type
    gate.press(event.code, hit); // the gate ignores key repeat
  });
  document.addEventListener("keyup", (event) => gate.release(event.code));
  addEventListener("blur", () => gate.cancelAll());

  // --- buttons, dialogs, settings ---
  $("copy").addEventListener("click", copy);
  $("clear").addEventListener("click", clear);
  wireDialog($("help-dialog"), $("help"));
  wireDialog($("settings-dialog"), $("settings"));
  createKeymap($("keymap"), data.bindings, data.layout);
  createSettingsPanel($("settings-form"), settings.current, (next) => {
    settings.current = next;
    applySettings(next);
    render();
    saveSettings(storage(), next);
    gate.configure(next);
  });

  loading.hidden = true;
  $("app").hidden = false;
  render();
}

// Works offline once visited. Needs https or localhost, so it is skipped elsewhere.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

main();
