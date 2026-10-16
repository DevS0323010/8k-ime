// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

/**
 * Decides when a key press counts, to cope with involuntary movement:
 *
 *   holdMs    the key must stay down this long before it counts (0 = no wait);
 *   onRelease (per press) it fires when the key is let go, not when pressed,
 *             and cancel() drops it, as when a finger slides off the key.
 *
 * `hit` is whatever the caller wants back in `fire`. `id` names the physical
 * key or pointer, so key repeat and the matching release are found.
 */
export class PressGate {
  /**
   * @param {object} options
   * @param {(hit: object) => void} options.fire
   * @param {(hit: object, ms: number) => void} [options.onHoldStart] a wait began
   * @param {(hit: object) => void} [options.onHoldEnd] the wait ended or was dropped
   * @param {(fn: () => void, ms: number) => unknown} [options.setTimer]
   * @param {(timer: unknown) => void} [options.clearTimer]
   */
  constructor({
    fire,
    onHoldStart,
    onHoldEnd,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (timer) => clearTimeout(timer),
  }) {
    Object.assign(this, { fireHit: fire, onHoldStart, onHoldEnd, setTimer, clearTimer });
    this.holdMs = 0;
    this.active = new Map(); // id -> press in progress
  }

  configure({ holdMs = 0 }) {
    this.holdMs = holdMs;
  }

  press(id, hit, { onRelease = false } = {}) {
    if (this.active.has(id)) return; // key repeat
    const press = { hit, onRelease, ready: false, timer: null };
    this.active.set(id, press);

    if (this.holdMs <= 0) {
      this.#ready(press);
      return;
    }
    this.onHoldStart?.(hit, this.holdMs);
    press.timer = this.setTimer(() => {
      press.timer = null;
      this.onHoldEnd?.(hit);
      this.#ready(press);
    }, this.holdMs);
  }

  /** The key was let go. */
  release(id) {
    const press = this.#drop(id);
    if (press?.onRelease && press.ready) this.fireHit(press.hit);
  }

  /** The press is abandoned (finger slid off the key, window lost focus). */
  cancel(id) {
    this.#drop(id);
  }

  cancelAll() {
    for (const id of [...this.active.keys()]) this.cancel(id);
  }

  #ready(press) {
    if (press.onRelease) press.ready = true;
    else this.fireHit(press.hit);
  }

  #drop(id) {
    const press = this.active.get(id);
    if (!press) return undefined;
    this.active.delete(id);
    if (press.timer !== null) {
      this.clearTimer(press.timer);
      this.onHoldEnd?.(press.hit);
    }
    return press;
  }
}
