// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

/**
 * Wires an on-screen button to a press gate. `getHit()` says what the button
 * means right now, or null for an empty slot. Releasing outside the button
 * cancels the press, so a finger that slides off does nothing. The button
 * never takes focus.
 *
 * @param {HTMLElement} button
 * @param {() => object | null} getHit
 * @param {{onDown: Function, onUp: Function, onCancel: Function, onClick: Function}} handlers
 */
export function bindPress(button, getHit, { onDown, onUp, onCancel, onClick }) {
  let active = null; // the pointer that is holding this button down, if any

  const inside = (event) => {
    const box = button.getBoundingClientRect();
    return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
  };
  const idOf = (event) => `pointer:${event.pointerId}`;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault(); // no focus change, no text selection, no ghost click
    const hit = getHit();
    if (!hit) return;
    active = event.pointerId;
    // Keep the pointer's events coming here, so a mouse released after being dragged
    // off the button still ends the press (touch does this by itself).
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone.
    }
    button.classList.add("down");
    onDown(idOf(event), hit);
  });
  button.addEventListener("pointermove", (event) => {
    if (event.pointerId === active) button.classList.toggle("down", inside(event));
  });
  button.addEventListener("pointerup", (event) => {
    if (event.pointerId !== active) return;
    active = null;
    button.classList.remove("down");
    if (inside(event)) onUp(idOf(event));
    else onCancel(idOf(event));
  });
  const abandon = (event) => {
    if (event.pointerId !== active) return;
    active = null;
    button.classList.remove("down");
    onCancel(idOf(event));
  };
  button.addEventListener("pointercancel", abandon);
  button.addEventListener("lostpointercapture", abandon); // anything else that ends the press
  // A click with no pointer behind it (detail 0) comes from assistive technology.
  button.addEventListener("click", (event) => {
    const hit = event.detail === 0 && getHit();
    if (hit) onClick(hit);
  });
}
