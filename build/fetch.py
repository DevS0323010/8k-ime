#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 s0323010
"""Downloads the enabled sources of sources.toml into build/cache/<id>/.

Each download is checked against build/sources.lock.toml. Run with --lock to
(re)write the lock from the cached or downloaded files; review the diff before committing.

    python build/fetch.py [--lock] [id ...]
"""
import argparse
import hashlib
import shutil
import sys
import tomllib
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).parent
CACHE = HERE / "cache"
LOCK = HERE / "sources.lock.toml"


def load_sources(only=()):
    with open(HERE / "sources.toml", "rb") as f:
        sources = [s for s in tomllib.load(f)["source"] if s["enabled"]]
    if only:
        unknown = set(only) - {s["id"] for s in sources}
        if unknown:
            sys.exit(f"Unknown or disabled source ids: {', '.join(sorted(unknown))}")
        sources = [s for s in sources if s["id"] in only]
    return sources


def load_lock():
    if not LOCK.exists():
        return {}
    with open(LOCK, "rb") as f:
        return tomllib.load(f)


def write_lock(lock):
    lines = ["# Written by build/fetch.py --lock. Pins the exact bytes each source had.\n"]
    for sid in sorted(lock):
        lines.append(f'\n[{sid}]\nsha256 = "{lock[sid]["sha256"]}"\nsize = {lock[sid]["size"]}\n')
    LOCK.write_text("".join(lines), encoding="utf-8")


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "8k-ime-build"})
    tmp = dest.with_suffix(dest.suffix + ".part")
    digest = hashlib.sha256()
    size = 0
    with urllib.request.urlopen(req, timeout=60) as resp, open(tmp, "wb") as out:
        while chunk := resp.read(1 << 20):
            out.write(chunk)
            digest.update(chunk)
            size += len(chunk)
    tmp.replace(dest)
    return digest.hexdigest(), size


def extract_zip(archive, target):
    root = target.resolve()
    with zipfile.ZipFile(archive) as z:
        for member in z.namelist():
            if not (root / member).resolve().is_relative_to(root):
                sys.exit(f"Refusing unsafe path in {archive.name}: {member}")
        z.extractall(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--lock", action="store_true", help="write sources.lock.toml")
    parser.add_argument("ids", nargs="*")
    args = parser.parse_args()

    lock = load_lock()
    for src in load_sources(args.ids):
        sid = src["id"]
        folder = CACHE / sid
        archive = folder / Path(src["url"]).name
        pinned = lock.get(sid)

        if archive.exists():
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            size = archive.stat().st_size
            status = "cached"
        else:
            folder.mkdir(parents=True, exist_ok=True)
            print(f"[{sid}] downloading {src['url']}")
            digest, size = download(src["url"], archive)
            status = "downloaded"

        if args.lock:
            lock[sid] = {"sha256": digest, "size": size}
        elif pinned is None:
            print(f"[{sid}] WARNING: not in sources.lock.toml (run with --lock)")
        elif pinned["sha256"] != digest:
            archive.unlink()  # forces a fresh download on the next run
            sys.exit(f"[{sid}] checksum mismatch: expected {pinned['sha256']}, got {digest}")

        if src.get("extract") == "zip":
            marker = folder / ".extracted"
            if not marker.exists() or marker.read_text() != digest:
                print(f"[{sid}] extracting")
                for child in folder.iterdir():
                    if child != archive:
                        shutil.rmtree(child) if child.is_dir() else child.unlink()
                extract_zip(archive, folder)
                marker.write_text(digest)
        print(f"[{sid}] {status}, sha256 {digest[:12]}…, {size:,} bytes")

    if args.lock:
        write_lock(lock)
        print(f"Wrote {LOCK.relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()
