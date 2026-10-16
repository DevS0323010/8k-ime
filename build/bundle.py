#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 s0323010
"""Writes dist/ime.html: the whole page in one file that works from file://.

    python3 build/bundle.py

The ES modules under src/ are flattened into one classic script (imports and
`export` keywords dropped, files in dependency order), the stylesheet is
inlined, the icon becomes a data URI, the manifest is dropped, and the layout, key bindings and data files are embedded in place of
src/load.js. Module-level names must therefore be unique across src/; the
script checks that.
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
IMPORT = re.compile(r'^import\s+(?:[^;]*?)\s+from\s+"(\.{1,2}/[^"]+)";\n', re.M)
EXPORT_LIST = re.compile(r"^export\s*\{[^}]*\};\n", re.M)
EXPORT_DECL = re.compile(r"^export\s+(?=(?:async\s+)?(?:function|class|const|let)\b)", re.M)
TOP_LEVEL = re.compile(r"^(?:async\s+)?(?:function|class|const|let)\s+([A-Za-z_$][\w$]*)", re.M)


def order_modules(entry):
    """Dependency order, dependencies first, starting from `entry`."""
    done, ordered = set(), []

    def visit(path):
        if path in done:
            return
        done.add(path)
        for target in IMPORT.findall(path.read_text(encoding="utf-8")):
            visit((path.parent / target).resolve())
        ordered.append(path)

    visit(entry)
    return ordered


def flatten(path, replacements):
    text = replacements.get(path, path.read_text(encoding="utf-8"))
    text = IMPORT.sub("", text)
    text = EXPORT_LIST.sub("", text)
    return EXPORT_DECL.sub("", text)


def embedded_load():
    """A stand-in for src/load.js with everything inlined."""
    data = {
        "layout": json.loads((SRC / "layout" / "en.json").read_text(encoding="utf-8")),
        "bindings": json.loads((SRC / "layout" / "keybindings.json").read_text(encoding="utf-8")),
        "words": (ROOT / "data" / "keymap_words.txt").read_text(encoding="utf-8"),
        "ngrams": (ROOT / "data" / "ngram_model.txt").read_text(encoding="utf-8"),
    }
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f"const EMBEDDED_DATA = {payload};\nasync function loadAll() {{ return EMBEDDED_DATA; }}\n"


def main():
    entry = SRC / "main.js"
    modules = order_modules(entry)
    load_js = (SRC / "load.js").resolve()
    replacements = {load_js: embedded_load()}

    seen = {}
    for path in modules:
        for name in TOP_LEVEL.findall(IMPORT.sub("", replacements.get(path, path.read_text(encoding="utf-8")))):
            if name in seen:
                sys.exit(f"Top-level name {name!r} is defined in both {seen[name]} and {path.name}")
            seen[name] = path.name

    script = "\n".join(f"// --- {p.relative_to(ROOT)} ---\n{flatten(p, replacements)}" for p in modules)
    script = script.replace("</script", "<\\/script")
    css = (SRC / "style.css").read_text(encoding="utf-8")

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html, n_css = re.subn(r'<link rel="stylesheet" href="src/style.css">', lambda _: f"<style>\n{css}</style>", html)
    html, n_js = re.subn(
        r'<script type="module" src="src/main.js"></script>\n?', "", html
    )
    html, n_manifest = re.subn(r'  <link rel="manifest"[^>]*>\n', "", html)
    html, n_touch = re.subn(r'  <link rel="apple-touch-icon"[^>]*>\n', "", html)
    icon = (ROOT / "icons" / "icon.svg").read_text(encoding="utf-8")
    html, n_icon = re.subn(
        r'href="icons/icon.svg"',
        lambda _: 'href="data:image/svg+xml,' + quote(icon) + '"',
        html,
    )
    if (n_css, n_js, n_manifest, n_touch, n_icon) != (1, 1, 1, 1, 1):
        sys.exit("index.html no longer matches the tags bundle.py rewrites")
    html = html.replace("</body>", f"<script>\n(() => {{\n\"use strict\";\n{script}\n}})();\n</script>\n</body>")

    out = ROOT / "dist" / "ime.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"Wrote {out.relative_to(ROOT)} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
