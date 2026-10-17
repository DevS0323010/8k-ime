// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

const STORAGE_KEY = "8k-ime-settings";

export const DEFAULTS = {
  textSize: 1, // multiplier for all type
  theme: "auto", // auto | light | dark | contrast
  screenFire: "release", // on-screen keys fire when pressed or when released
  tapSuggestion: "select", // tapping a suggestion highlights it, or writes it at once
  holdMs: 0, // how long a key must be held
  preview: true, // show the next word, underlined, before it is written
  blink: false, // the cursor blinks
};

/** The allowed values of each setting, in the order the panel shows them. */
export const CHOICES = {
  textSize: [1, 1.25, 1.5, 2],
  theme: ["auto", "light", "dark", "contrast"],
  screenFire: ["press", "release"],
  tapSuggestion: ["select", "write"],
  holdMs: [0, 200, 400, 600, 1000],
};

/** Keeps the values that are allowed and falls back to the defaults for the rest. */
export function normalize(raw) {
  const settings = { ...DEFAULTS };
  if (raw && typeof raw === "object") {
    for (const [key, allowed] of Object.entries(CHOICES)) {
      if (allowed.includes(raw[key])) settings[key] = raw[key];
    }
    for (const key of ["preview", "blink"]) {
      if (typeof raw[key] === "boolean") settings[key] = raw[key];
    }
  }
  return settings;
}

export function loadSettings(storage) {
  try {
    return normalize(JSON.parse(storage.getItem(STORAGE_KEY)));
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(storage, settings) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked; the settings then last until the page closes.
  }
}

/** Puts the settings on the page: CSS variables and attributes the style sheet reads. */
export function applySettings(settings, root = document.documentElement) {
  root.style.setProperty("--scale", String(settings.textSize));
  root.style.setProperty("--hold-ms", `${settings.holdMs}ms`);
  if (settings.theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  if (settings.blink) root.dataset.blink = "";
  else delete root.dataset.blink;
}
