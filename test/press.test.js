// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010

import assert from "node:assert/strict";
import { test } from "node:test";

import { PressGate } from "../src/ui/press.js";

/** A gate with a fake clock; advance(ms) moves time and runs due timers. */
function setup(settings = {}) {
  let time = 0;
  let next = 1;
  const timers = new Map();
  const fired = [];
  const holds = [];
  const gate = new PressGate({
    fire: (hit) => fired.push(hit.token ?? hit.action),
    onHoldStart: (hit, ms) => holds.push(["start", hit.token, ms]),
    onHoldEnd: (hit) => holds.push(["end", hit.token]),
    setTimer: (fn, ms) => (timers.set(next, { fn, at: time + ms }), next++),
    clearTimer: (id) => timers.delete(id),
  });
  gate.configure(settings);
  const advance = (ms) => {
    const end = time + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      time = due[1].at;
      due[1].fn();
    }
    time = end;
  };
  return { gate, advance, fired, holds };
}

const token = (t) => ({ type: "token", token: t });

test("by default a press fires at once", () => {
  const { gate, fired } = setup();
  gate.press("KeyQ", token("1"));
  assert.deepEqual(fired, ["1"]);
});

test("key repeat is one press", () => {
  const { gate, fired } = setup();
  gate.press("KeyQ", token("1"));
  gate.press("KeyQ", token("1"));
  gate.press("KeyQ", token("1"));
  assert.deepEqual(fired, ["1"]);
  gate.release("KeyQ");
  gate.press("KeyQ", token("1"));
  assert.deepEqual(fired, ["1", "1"]);
});

test("a hold time makes a short brush not count", () => {
  const { gate, advance, fired, holds } = setup({ holdMs: 400 });
  gate.press("KeyQ", token("1"));
  advance(300);
  gate.release("KeyQ");
  advance(1000);
  assert.deepEqual(fired, []);
  assert.deepEqual(holds, [["start", "1", 400], ["end", "1"]]);
});

test("a hold time fires once the key has been held long enough, still down", () => {
  const { gate, advance, fired } = setup({ holdMs: 400 });
  gate.press("KeyQ", token("1"));
  advance(399);
  assert.deepEqual(fired, []);
  advance(1);
  assert.deepEqual(fired, ["1"]);
  gate.release("KeyQ");
  assert.deepEqual(fired, ["1"], "releasing does not fire again");
});

test("on release: fires when let go, not when pressed", () => {
  const { gate, fired } = setup();
  gate.press("p1", token("2"), { onRelease: true });
  assert.deepEqual(fired, []);
  gate.release("p1");
  assert.deepEqual(fired, ["2"]);
});

test("on release: cancel (finger slid off) drops the press", () => {
  const { gate, fired } = setup();
  gate.press("p1", token("2"), { onRelease: true });
  gate.cancel("p1");
  gate.release("p1");
  assert.deepEqual(fired, []);
});

test("on release with a hold time: needs the hold, then fires on release", () => {
  const { gate, advance, fired } = setup({ holdMs: 200 });
  gate.press("p1", token("2"), { onRelease: true });
  advance(100);
  gate.release("p1");
  assert.deepEqual(fired, [], "released too soon");
  gate.press("p1", token("2"), { onRelease: true });
  advance(250);
  assert.deepEqual(fired, [], "held long enough but not released yet");
  gate.release("p1");
  assert.deepEqual(fired, ["2"]);
});

test("cancelAll drops everything in progress", () => {
  const { gate, advance, fired } = setup({ holdMs: 100 });
  gate.press("a", token("1"));
  gate.press("b", token("2"));
  gate.cancelAll();
  advance(500);
  assert.deepEqual(fired, []);
});
