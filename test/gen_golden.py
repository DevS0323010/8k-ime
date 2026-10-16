#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 s0323010
"""Regenerates test/golden.json by running key sequences through the Python
prototype in tools/reference/ime.py, the oracle the JS core must match.

    python test/gen_golden.py

Re-run it after rebuilding data/ (the expected output depends on the data).
Each case is {"tokens": "...", "steps": [...]} where step i is the state after
token i: [options (first 12), option count, option id, buffer, display buffer,
mode, context, actions, key labels or null if unchanged, func label].
"""
import contextlib
import io
import json
import os
import random
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools" / "reference"))


# --- a stand-in for pynput that records what the prototype would have typed ---
class Key:
    ctrl = "ctrl"
    backspace = "backspace"


class Controller:
    def __init__(self):
        self.events = []

    def type(self, text):
        self.events.append(("type", text))

    def press(self, key):
        self.events.append(("press", key))

    def release(self, key):
        self.events.append(("release", key))


pynput = types.ModuleType("pynput")
keyboard = types.ModuleType("pynput.keyboard")
keyboard.Controller, keyboard.Key = Controller, Key
pynput.keyboard = keyboard
sys.modules.update({"pynput": pynput, "pynput.keyboard": keyboard})

os.chdir(ROOT / "data")  # the prototype opens its data files from the cwd
with contextlib.redirect_stdout(io.StringIO()):
    import ime as reference
    prototype = reference.IME()


def actions_since(events):
    out, i = [], 0
    while i < len(events):
        kind, value = events[i]
        if kind == "type":
            out.append(["insert", value])
            i += 1
        elif events[i : i + 4] == [("press", "ctrl"), ("press", "backspace"),
                                   ("release", "backspace"), ("release", "ctrl")]:
            out.append(["deleteWord"])
            i += 4
        elif events[i : i + 2] == [("press", "backspace"), ("release", "backspace")]:
            out.append(["backspace"])
            i += 2
        else:
            raise ValueError(f"Unexpected controller events: {events[i:]}")
    return out


def labels(ime):
    """The labels gui.py's update_ui puts on the keys, as (six keys, func)."""
    keys = []
    for i in range(6):
        if ime.mode == "0":
            keys.append(ime.key_disp_func[i][1] if ime.buffer == "F" else ime.key_disp[i][1])
        else:
            keys.append(" ".join(ime.mode_lists[ime.mode][ime.key_disp[i][0]]))
    back = (len(ime.buffer) > 0 and ime.option_id == -1) or ime.mode != "0"
    return keys, "<<" if back else "Func"


def reset():
    prototype.buffer, prototype.context = "", ""
    prototype.options, prototype.option_id, prototype.mode = [], -1, "0"
    prototype.controller.events.clear()


def run(tokens):
    """Feeds tokens to the prototype; returns the recorded steps."""
    reset()
    steps, last_keys = [], None
    for token in tokens:
        prototype.controller.events.clear()
        prototype.get_input(token)
        keys, func = labels(prototype)
        steps.append([
            prototype.options[:12], len(prototype.options), prototype.option_id,
            prototype.buffer, prototype.get_buffer(), prototype.mode, prototype.context,
            actions_since(prototype.controller.events),
            None if keys == last_keys else keys, func,
        ])
        last_keys = keys
    return steps


def sentence_tokens(rng, words, count):
    """Types `count` random words the way a person would: keys, then S until the word shows."""
    letter_key = {c: k for k, cs in prototype.key_map.items() for c in cs}
    reset()
    tokens = ""
    for _ in range(count):
        word = rng.choice(words)
        for c in (letter_key[c] for c in word):
            prototype.get_input(c)
            tokens += c
        for _ in range(len(prototype.options)):
            if prototype.options and prototype.option_id >= 0 and prototype.options[prototype.option_id] == word:
                break
            prototype.get_input("S")
            tokens += "S"
    return tokens


def main():
    rng = random.Random(8000)
    common = list(prototype.freq)[:3000]
    cases = [sentence_tokens(rng, common, 7) for _ in range(30)]

    # Noisy streams hit editing, function mode and the symbol modes.
    for _ in range(30):
        cases.append("".join(rng.choices("123456SF", weights=[3, 3, 3, 3, 3, 3, 2, 2], k=45)))
    # Scripted visits to each symbol mode, a newline and deletions.
    cases += ["F5" + "1S" + "22S" + "6S" + "S" + "F",
              "F3" + "11S" + "66S" + "3S" + "S",
              "F4" + "1S" + "2S" + "33S" + "S" + "F",
              "1123S" + "F" + "FF" + "F" + "FS" + "FF",
              "26SS" + "56S" + "FFF" + "S"]

    golden = [{"tokens": t, "steps": run(t)} for t in cases]
    path = ROOT / "test" / "golden.json"
    path.write_text(json.dumps(golden, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    steps = sum(len(c["steps"]) for c in golden)
    print(f"Wrote {len(golden)} cases, {steps} steps, {path.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
