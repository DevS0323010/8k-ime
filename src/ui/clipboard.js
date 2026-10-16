// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

/**
 * Copies text to the clipboard. Call it from a key press or tap. Uses the
 * Clipboard API where the page is a secure context (https, localhost) and
 * falls back to a hidden textarea and execCommand elsewhere, such as file://.
 * Returns whether it worked.
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyWithSelection(text);
  }
}

function copyWithSelection(text) {
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true; // keeps the on-screen keyboard away on phones
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
