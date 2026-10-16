#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 s0323010
"""Builds data/keymap_words.txt and data/ngram_model.txt from sources.toml.

    python build/fetch.py     # once, downloads and verifies the corpora
    python build/build.py

keymap_words.txt: one `word q` per line, most frequent first, where
q = round(-100 * log10(frequency)). Frequencies come from wordfreq.
ngram_model.txt:  one line per history, `history word count word count ...`.
"""
import hashlib
import json
import re
import sys
import tomllib
from collections import Counter, defaultdict
from importlib.metadata import version
from math import log10
from pathlib import Path

from wordfreq import top_n_list, word_frequency

HERE = Path(__file__).parent
ROOT = HERE.parent
CACHE = HERE / "cache"
OUT = ROOT / "data"
START = "<s?>"

WORD_RE = re.compile(r"[a-z]+(?:'[a-z]+)*")  # also what the vocabulary may contain
SENTENCE_END = re.compile(r"(?<=[.!?])[\"')\]]*\s+")
GUTENBERG_START = re.compile(r"\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG.*?\*\*\*", re.S)
GUTENBERG_END = re.compile(r"\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG")


def load_config():
    with open(HERE / "sources.toml", "rb") as f:
        config = tomllib.load(f)
    return config["build"], [s for s in config["source"] if s["enabled"]]


def check_notice(sources):
    notice = (ROOT / "NOTICE.md").read_text(encoding="utf-8")
    missing = [s["name"] for s in sources if s["name"] not in notice]
    if missing:
        sys.exit("NOTICE.md does not mention: " + "; ".join(missing))


def build_vocabulary(cfg):
    freqs = {}
    for word in top_n_list("en", cfg["vocab_top_n"]):
        word = word.replace("’", "'")
        if WORD_RE.fullmatch(word):
            freq = word_frequency(word, "en")
            if freq > cfg["min_word_freq"]:
                freqs[word] = freq
    return dict(sorted(freqs.items(), key=lambda kv: (-kv[1], kv[0])))


def sentences(path, kind):
    text = path.read_text(encoding="utf-8", errors="replace")
    if kind == "lines":
        yield from (line for line in text.splitlines() if line.strip())
        return
    start = GUTENBERG_START.search(text)
    if start:
        text = text[start.end():]
    end = GUTENBERG_END.search(text)
    if end:
        text = text[: end.start()]
    for paragraph in re.split(r"\n\s*\n", text):
        paragraph = " ".join(paragraph.split())
        yield from SENTENCE_END.split(paragraph)


def tokenize(sentence):
    """Lowercase words; None marks a token that breaks the word chain (numbers etc.)."""
    tokens = []
    for raw in sentence.replace("’", "'").replace("—", " ").replace("-", " ").split():
        if any(c.isdigit() for c in raw):
            tokens.append(None)
            continue
        word = "".join(c for c in raw.lower() if c.isalpha() or c == "'").strip("'")
        if word:
            tokens.append(word)
    return tokens


def is_held_out(sentence, percent):
    digest = hashlib.sha1(" ".join(sentence.lower().split()).encode()).digest()
    return int.from_bytes(digest[:4], "big") % 100 < percent


def count_source(src, vocab, holdout):
    """Returns ({history: Counter of next words}, number of bigrams, held-out sentences)."""
    counts = defaultdict(Counter)
    total = held_out = 0
    for path in sorted(p for pattern in src["include"] for p in (CACHE / src["id"]).glob(pattern)):
        for sentence in sentences(path, src["kind"]):
            if is_held_out(sentence, holdout):
                held_out += 1
                continue
            history = START
            for word in tokenize(sentence):
                if word is None or word not in vocab:
                    history = None
                    continue
                if history is not None:
                    counts[history][word] += 1
                    total += 1
                history = word
    return counts, total, held_out


def main():
    cfg, sources = load_config()
    check_notice(sources)
    print("Building vocabulary from wordfreq...")
    freqs = build_vocabulary(cfg)
    vocab = set(freqs)
    print(f"  {len(vocab):,} words")

    raw = defaultdict(Counter)
    weighted = defaultdict(lambda: defaultdict(float))
    per_source = {}
    for src in sources:
        if not (CACHE / src["id"]).exists():
            sys.exit(f"{src['id']} is not downloaded; run build/fetch.py first")
        print(f"Counting {src['id']}...")
        counts, total, held_out = count_source(src, vocab, cfg["holdout_percent"])
        if total == 0:
            sys.exit(f"{src['id']}: no bigrams found; check `include` and `kind`")
        per_source[src["id"]] = (counts, total, src["weight"])
        print(f"  {total:,} bigrams, {held_out:,} sentences held out")

    # Every source contributes weight/sum(weights) of the final mass.
    mass = sum(total for _, total, _ in per_source.values())
    weight_sum = sum(w for _, _, w in per_source.values())
    for counts, total, weight in per_source.values():
        scale = weight / weight_sum * mass / total
        for history, nxt in counts.items():
            for word, count in nxt.items():
                raw[history][word] += count
                weighted[history][word] += count * scale

    model = {}
    kept = 0
    for history in sorted(raw):
        nxt = {
            word: max(1, round(weighted[history][word]))
            for word, count in raw[history].items()
            if count >= cfg["min_bigram_count"]
        }
        if nxt:
            model[history] = dict(sorted(nxt.items(), key=lambda kv: (-kv[1], kv[0])))
            kept += len(nxt)

    # Words that only ever appear in the vocabulary file cost little; keep them all.
    OUT.mkdir(exist_ok=True)
    with open(OUT / "keymap_words.txt", "w", encoding="utf-8", newline="\n") as f:
        f.writelines(f"{w} {round(-100 * log10(p))}\n" for w, p in freqs.items())
    with open(OUT / "ngram_model.txt", "w", encoding="utf-8", newline="\n") as f:
        for history, nxt in model.items():
            f.write(f"{history} {' '.join(f'{w} {c}' for w, c in nxt.items())}\n")

    lock = {}
    lock_path = HERE / "sources.lock.toml"
    if lock_path.exists():
        with open(lock_path, "rb") as f:
            lock = tomllib.load(f)
    info = {
        "wordfreq": version("wordfreq"),
        "settings": cfg,
        "sources": {
            s["id"]: {"license": s["license"], "weight": s["weight"],
                      "sha256": lock.get(s["id"], {}).get("sha256")}
            for s in sources
        },
    }
    (OUT / "build-info.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(freqs):,} words and {kept:,} bigrams to {OUT}")


if __name__ == "__main__":
    main()
