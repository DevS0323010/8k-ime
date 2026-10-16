# Reference copy of the Python prototype, used only to generate test/golden.json.
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 s0323010
from collections import Counter, defaultdict

from pynput.keyboard import Controller, Key

START = "<s?>"


class NgramLanguageModel:
    """Bigram counts. Candidates seen after the history word are scored by their
    bigram count; the rest back off to unigram frequency on the same scale.

    The file is plain text, one line per history: `history word count word count ...`.
    """

    def __init__(self, tokenized_sentences=None):
        self.bigram_counts: dict[str, dict[str, int]] = {}

        if tokenized_sentences:
            self.train(tokenized_sentences)

    def train(self, tokenized_sentences):
        print("Building counts from corpus sentences...")
        counts = defaultdict(Counter)
        for sentence in tokenized_sentences:
            history = START  # Start-of-sentence marker
            for word in sentence:
                word = word.lower()
                counts[history][word] += 1
                history = word
        self.bigram_counts = {h: dict(c) for h, c in counts.items()}

    def score_candidates(
        self, history_word: str, candidates: list[str], freq: dict[str, float]
    ) -> list[float]:
        """Scores candidates given the preceding word.

        A candidate on the bigram list for `history_word` scores its bigram count.
        Any other candidate scores `base * unigram frequency`, where `base` is the
        smallest count/frequency ratio among the bigram candidates, so both groups
        share one scale. With no bigram candidates `base` stays huge and the
        ranking is purely by unigram frequency.
        """
        followers = self.bigram_counts.get(history_word.lower() or START, {})
        base = 1e18
        for w in candidates:
            if w in followers:
                base = min(base, followers[w] / freq[w])
        return [followers.get(w) or base * freq[w] for w in candidates]

    def save(self, filepath: str):
        """Writes the model as plain text."""
        with open(filepath, "w", encoding="utf-8") as f:
            for history, next_words in self.bigram_counts.items():
                pairs = " ".join(f"{w} {c}" for w, c in next_words.items())
                f.write(f"{history} {pairs}\n")
        print(f"Model successfully saved to {filepath}")

    @classmethod
    def load(cls, filepath: str) -> "NgramLanguageModel":
        """Loads a model saved by `save` from disk."""
        model = cls()
        with open(filepath, encoding="utf-8") as f:
            for line in f:
                history, *pairs = line.split()
                model.bigram_counts.setdefault(history, {}).update(
                    (pairs[i], int(pairs[i + 1])) for i in range(0, len(pairs), 2)
                )
        print(f"Model successfully loaded from {filepath}")
        return model


def load_words(filepath: str) -> dict[str, float]:
    """Loads `word q` lines (most frequent first) into {word: frequency}.

    q is the frequency's negative log10 times 100, which keeps the file small.
    """
    with open(filepath, encoding="utf-8") as f:
        return {w: 10 ** (-int(q) / 100) for w, q in map(str.split, f)}


def clean_and_tokenize(sentence_words: list[str]) -> list[str]:
    """
    Takes a list of raw word tokens (or a sentence string split by whitespace),
    splits hyphenated words, strips non-alphabetical characters (preserving apostrophes),
    and drops empty results.
    """
    cleaned_words = []

    for raw_token in sentence_words:
        # 1. Replace hyphens with spaces to split compound words (e.g. "bird-watching" -> "bird watching")
        sub_tokens = raw_token.replace("-", " ").split()

        for token in sub_tokens:
            # 2. Convert to lowercase for consistent IME matching
            token = token.lower()

            # 3. Strip out anything that is NOT a letter or an apostrophe.
            # This regex removes punctuation at the edges or inside symbols,
            # while keeping internal apostrophes (e.g., "don't" stays "don't").
            # Alternatively, if you want ONLY a-z and ' :
            cleaned = "".join([c for c in token if c.isalpha() or c == "'"])

            # Remove leading/trailing apostrophes if any got stranded (e.g., "'hello'" -> "hello")
            cleaned = cleaned.strip("'")

            if cleaned:
                cleaned_words.append(cleaned)

    return cleaned_words


def get_candidates(
    context: str,
    seq: str,
    lm: NgramLanguageModel,
    prefix_map,
    setup,
    freq: dict[str, float],
) -> list[tuple[str, float]]:
    """Fast candidate prediction using pre-indexed prefix buckets and pruning."""
    if not seq:
        return []

    context_words = context.strip().split()
    history_word = context_words[-1] if context_words else ""

    # Buckets are ordered by frequency, so the first 40 are the likeliest.
    exact = setup.get(seq, [])
    prefix = prefix_map.get(seq, [])[:40]

    # Score both groups together so they share one backoff scale.
    scores = lm.score_candidates(history_word, exact + prefix, freq)
    exact_matches = sorted(zip(exact, scores), key=lambda x: x[1], reverse=True)
    prefix_matches = sorted(
        ((w, sc / 10) for w, sc in zip(prefix, scores[len(exact):])),
        key=lambda x: x[1],
        reverse=True,
    )[:3]

    # The first choice is never a prefix-only match.
    if exact_matches:
        rest = sorted(exact_matches[1:] + prefix_matches, key=lambda x: x[1], reverse=True)
        return exact_matches[:1] + rest
    return prefix_matches


class IME:
    def __init__(self) -> None:
        self.lm = NgramLanguageModel.load("ngram_model.txt")
        self.controller: Controller = Controller()
        self.setup = {}
        self.prefix_map = defaultdict(list)
        self.buffer = ""
        self.context = ""
        self.options = []
        self.option_id = -1
        self.mode = "0"
        self.key_map = {
            "1": ["a", "s", "p"],
            "2": ["i", "n", "w", "g", "k"],
            "3": ["t", "u", "y", "b", "q", "'"],
            "4": ["h", "d", "c", "z", "v"],
            "5": ["o", "r", "m", "x"],
            "6": ["e", "l", "f", "j"],
        }
        self.key_disp = [
            ("1", "SPA"),
            ("6", "J-ELF"),
            ("2", "K-WING"),
            ("5", "X-ORM"),
            ("3", "Q'T-BUY"),
            ("4", "ZH-VCD")
        ]

        self.key_disp_func = [
            ("1", "-"),
            ("6", "-"),
            ("2", "-"),
            ("5", "abc"),
            ("3", "123"),
            ("4", ".?!")
        ]
        self.mode_lists = {
            "5": {
                "1": ["a", "s", "p"],
                "2": ["i", "n", "w", "g", "k"],
                "3": ["t", "u", "y", "b", "q"],
                "4": ["h", "d", "c", "z", "v"],
                "5": ["o", "r", "m", "x"],
                "6": ["e", "l", "f", "j"],
            },
            "3": {
                "1": ["1", "2"],
                "6": ["3", "4"],
                "2": ["5", "6"],
                "5": ["7", "8"],
                "3": ["9", "0"],
                "4": ["+", "-"],
            },
            "4": {
                "1": [".", ":"],
                "2": [",", ";"],
                "3": ["!", "?"],
                "4": ["'", "\""],
                "5": ["(", ")"],
                "6": ["[", "]"],
            }
        }
        # The key sequence of a word is derived from its letters, so only the
        # words (most frequent first) are stored.
        letter_key = {ch: k for k, chars in self.key_map.items() for ch in chars}
        self.freq = load_words("keymap_words.txt")
        for word in self.freq:
            keys = "".join(letter_key[c] for c in word)
            self.setup.setdefault(keys, []).append(word)
            for i in range(1, len(keys)):
                self.prefix_map[keys[:i]].append(word)

    def get_input(self, inp: str):
        self.context = " ".join(self.context.split(" ")[-10:])
        if inp == "S":
            if self.mode == "0":
                if self.buffer == "F":
                    self.controller.type("\n")
                    self.context = ""
                    self.buffer = ""
                elif len(self.options) > 0:
                    self.option_id = (self.option_id + 1) % len(self.options)
            else:
                if self.buffer == "":
                    self.mode = "0"
                else:
                    v = self.mode_lists[self.mode][self.buffer[0]]
                    self.controller.type(v[(len(self.buffer)-1)%len(v)])
                    self.buffer = ""
        elif inp in self.key_map:
            if self.mode == "0":
                if self.buffer == "F":
                    self.buffer = ""
                    if inp in self.mode_lists:
                        self.option_id = -1
                        self.options = []
                        self.context = ""
                        self.mode = inp
                    return
                if self.option_id >= 0:
                    self.context += " " + self.options[self.option_id]
                    self.controller.type(self.options[self.option_id] + " ")
                    self.buffer = ""
                    self.option_id = -1
                    self.options = []
                self.buffer += inp
                self.option_id = -1
                self.options = [
                    i[0] for i in get_candidates(self.context, self.buffer, self.lm, self.prefix_map, self.setup, self.freq)
                ]
            else:
                if len(self.buffer) == 0 or self.buffer[-1] == inp:
                    self.buffer += inp
                else:
                    v = self.mode_lists[self.mode][self.buffer[0]]
                    self.controller.type(v[(len(self.buffer)-1)%len(v)])
                    self.buffer = inp
        elif inp == "F":
            if self.mode == "0":
                if self.option_id >= 0:
                    self.context += " " + self.options[self.option_id]
                    self.controller.type(self.options[self.option_id] + " ")
                    self.buffer = ""
                    self.option_id = -1
                    self.options = []
                if self.buffer == "F":
                    self.context = " ".join(self.context.split(" ")[:-1])
                    self.controller.press(Key.ctrl);
                    self.controller.press(Key.backspace);
                    self.controller.release(Key.backspace);
                    self.controller.release(Key.ctrl);
                    self.buffer = ""
                elif len(self.buffer) > 0:
                    self.buffer = self.buffer[:-1]
                    self.options = [
                        i[0] for i in get_candidates(self.context, self.buffer, self.lm, self.prefix_map, self.setup, self.freq)
                    ]
                else:
                    self.buffer = "F"
                    self.options = []
            else:
                if len(self.buffer) > 0:
                    self.buffer = ""
                else:
                    self.controller.press(Key.backspace);
                    self.controller.release(Key.backspace);

    def get_buffer(self):
        if self.mode == "0":
            return self.buffer.replace("1", "A").replace("6", "E").replace("2", "I").replace("5", "O").replace("3", "U").replace("4", "Z")
        if len(self.buffer) > 0:
            v = self.mode_lists[self.mode][self.buffer[0]]
            return v[(len(self.buffer)-1)%len(v)]
        return ""


def main():
    pass


if __name__ == "__main__":
    main()
