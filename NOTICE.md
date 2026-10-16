# NOTICE

## Project license

Copyright (C) 2026 s0323010

This project is licensed under the GNU General Public License, version 3
only (`GPL-3.0-only`). See [LICENSE](LICENSE). Source files carry:

```
SPDX-License-Identifier: GPL-3.0-only
Copyright (C) 2026 s0323010
```

GPL-3.0-only (not "or later") is used on purpose: CC BY-SA 4.0 material may be
adapted under GPLv3 but not under other GPL versions.

## Data licenses

The word lists and n-gram counts shipped in `data/` are derived from the
sources below. Only counts and frequencies are shipped, never the source texts.
Material licensed under CC BY-SA 4.0 is adapted and redistributed under
GPLv3, as CC BY-SA 4.0 section "Compatible License" permits.

**Status:** this list is the plan. Each entry's status changes to "In use" only
once its data is in the build, and its license is re-checked against the
source's own page at that time.

| Source | License | Used for | Status |
|---|---|---|---|
| [wordfreq](https://github.com/rspeer/wordfreq) data | CC BY-SA 4.0 | Vocabulary and unigram frequencies | In use |
| Project Gutenberg texts | Public domain (US) | Bigram counts | In use |
| NLTK `inaugural` | Public domain | Bigram counts | In use |
| Open American National Corpus (OANC), written parts only | No usage or redistribution restrictions | Bigram counts | In use |
| Common Voice English sentences | CC0 1.0 | Bigram counts | In use |
| Wikipedia | CC BY-SA 4.0 / GFDL | Bigram counts | Under consideration |
| Tatoeba English sentences | CC BY 2.0 FR (part CC0) | Bigram counts | Needs compatibility check with GPLv3 |
| MASC | CC BY 3.0 (US) | Bigram counts | Needs compatibility check with GPLv3 |

### Required credits

- **wordfreq:** word frequencies come from the wordfreq package
  (Robyn Speer et al.), whose data is CC BY-SA 4.0 and combines several
  sources, including SUBTLEX (Brysbaert et al.), OpenSubtitles, Wikipedia,
  Google Books Ngrams, the Leeds Internet Corpus, ParaCrawl and Twitter. The
  authors of SUBTLEX ask that its use be credited and that it is stated to be
  freely available data. See wordfreq's own `NOTICE` for the authoritative
  list and wording.
- **Wikipedia (if used):** text from Wikipedia contributors, CC BY-SA 4.0. The
  list of authors for each article is in its page history.
- **Tatoeba (if used):** sentences from [Tatoeba](https://tatoeba.org),
  contributors credited per sentence there.

### Explicitly excluded

These are not used, because their terms conflict with the GPL's ban on extra
restrictions, or are unclear:

- Brown Corpus (non-commercial use only)
- Reuters-21578 (Reuters Ltd. copyright, terms unclear)
- NLTK `webtext` (no clear license)
- NLTK `state_union`, `abc` (no clear license in NLTK's listing)

## Third-party code

Runtime dependencies, if any, are listed here with their licenses once added.
