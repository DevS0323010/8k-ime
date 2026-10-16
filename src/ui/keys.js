// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

/** Builds a Map from KeyboardEvent.code to {type: "token", token} or {type: "action", action}. */
export function buildKeyMap({ tokens, actions }) {
  const map = new Map();
  for (const [token, { main, numpad }] of Object.entries(tokens)) {
    for (const code of [...main, ...numpad]) map.set(code, { type: "token", token });
  }
  for (const [action, codes] of Object.entries(actions)) {
    for (const code of codes) map.set(code, { type: "action", action });
  }
  return map;
}

/**
 * What a key press means, or null if it is not ours. Combinations with Ctrl,
 * Alt or Meta are left to the browser. Keys are identified by physical position
 * (`code`), so the bindings are the same on any keyboard layout.
 */
export function resolveKey(event, keyMap) {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const binding = keyMap.get(event.code);
  return binding ? { ...binding, repeat: event.repeat } : null;
}
