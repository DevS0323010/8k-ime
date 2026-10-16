// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import { createIME } from "./core/index.js";
import { loadAll } from "./load.js";
import { copyText } from "./ui/clipboard.js";
import { buildKeyMap, resolveKey } from "./ui/keys.js";
import { createKeymap } from "./ui/keymap.js";
import { createKeypad } from "./ui/keypad.js";
import { createStatus } from "./ui/status.js";
import { Output } from "./ui/text.js";
import { createToast } from "./ui/toast.js";

const UNDO_MS = 6000;
const $ = (id) => document.getElementById(id);

function remember(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked; the page works without it.
  }
  return null;
}

async function main() {
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
  const status = createStatus(
    { bufferEl: $("buffer"), modeEl: $("mode"), candidatesEl: $("candidates") },
    data.layout,
  );

  function render() {
    outputEl.textContent = output.text;
    outputEl.scrollTop = outputEl.scrollHeight;
    status.render(ime);
    keypad.render(ime);
    $("copy").disabled = $("clear").disabled = output.text === "";
    if (undoToastShown && !output.canUndo) toast.hide();
  }

  function press(token) {
    output.apply(ime.input(token));
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

  const keypad = createKeypad($("keypad"), data.layout, press);
  createKeymap($("keymap"), data.bindings, data.layout);
  const keyMap = buildKeyMap(data.bindings);

  document.addEventListener("keydown", (event) => {
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
    if (hit.repeat) return;
    if (hit.type === "token") {
      keypad.flash(hit.token);
      press(hit.token);
    } else if (hit.action === "copy") {
      copy();
    } else if (hit.action === "clear") {
      clear();
    }
  });

  $("copy").addEventListener("click", copy);
  $("clear").addEventListener("click", clear);

  const details = $("help");
  // Open by default where there is a physical keyboard to learn; closed on touch screens.
  const saved = remember("help-open");
  details.open = saved === null ? !matchMedia("(pointer: coarse)").matches : saved === "true";
  details.addEventListener("toggle", () => remember("help-open", String(details.open)));

  loading.hidden = true;
  $("app").hidden = false;
  render();
}

// Works offline once visited. Needs https or localhost, so it is skipped elsewhere.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

main();
