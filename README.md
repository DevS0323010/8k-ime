# 8k-ime

A six-key predictive input method, built to run as static web pages. The
project is in progress; this README only covers building the data for now.

## Building the data

The word list and bigram model in `data/` are generated from the corpora listed
in [`build/sources.toml`](build/sources.toml). You need
[uv](https://docs.astral.sh/uv/) and Python 3.11 or newer.

```sh
# 1. Download the corpora (about 340 MB) and verify them against sources.lock.toml
uv run build/fetch.py

# 2. Build data/keymap_words.txt, data/ngram_model.txt and data/build-info.json
uv run --with wordfreq build/build.py
```

`fetch.py` uses only the standard library, so it needs no extra packages.
`build.py` needs [`wordfreq`](https://github.com/rspeer/wordfreq), which
`--with wordfreq` installs into a temporary environment; nothing is installed
permanently. Downloads are cached in `build/cache/` (git-ignored), so rerunning
is quick.

To change a source, a weight, or a threshold, edit `build/sources.toml` and run
step 2 again. After adding or changing a source, run `uv run build/fetch.py
--lock` to update the checksums, and add the source to [`NOTICE.md`](NOTICE.md),
since the build fails if an enabled source is missing there.

## Running the page

The page is static files; there is nothing to build. Browsers load ES modules
and data files over HTTP, so serve the folder instead of opening `index.html`
directly:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Keys are bound by physical position, in eight chunks (the page draws the map):
six letter keys, Func and Select. The keyboard only types through the input
method; `` ` `` copies the output, `Esc` clears it (Ctrl+Z or the Undo button
brings it back). On touch screens use the on-screen keys.

Spacing and capitals follow a few simple rules, not a language model (see the
header of `src/ui/text.js`): punctuation attaches to the word before it, a
sentence or line starts with a capital, "i" becomes "I", and quotes pair up.
Backspace in a symbol mode takes back a whole insertion, including the space a
period removed.

Once visited over https (or localhost) the page works offline, and browsers can
install it. For a single file that needs no server, run
`python3 build/bundle.py`; it writes `dist/ime.html` (about 3.6 MB, git-ignored)
with the scripts, styles and data inlined, and it works from `file://`.

## Tests

```sh
node --test                  # needs Node 20 or newer, no packages
python3 test/gen_golden.py   # regenerate test/golden.json after rebuilding data/
```

`test/golden.json` holds key sequences and the output the Python prototype in
`tools/reference/` gives for them; the JavaScript core in `src/core/` must
match it.

## License

GPL-3.0-only, see [LICENSE](LICENSE). The generated data is derived from
third-party corpora with their own terms; see [NOTICE.md](NOTICE.md).
