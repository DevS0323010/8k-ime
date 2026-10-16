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

## License

GPL-3.0-only, see [LICENSE](LICENSE). The generated data is derived from
third-party corpora with their own terms; see [NOTICE.md](NOTICE.md).
