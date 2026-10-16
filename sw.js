// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 s0323010
//
// Offline support. Files are fetched from the network when it is reachable
// (through the browser's own HTTP cache, so unchanged files are cheap) and
// from this cache otherwise. test/sw.test.js keeps PRECACHE in sync with the
// files on disk.

const CACHE = "8k-ime-v1";

const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon.svg",
  "src/core/candidates.js",
  "src/core/ime.js",
  "src/core/index.js",
  "src/core/model.js",
  "src/layout/en.json",
  "src/layout/keybindings.json",
  "src/load.js",
  "src/main.js",
  "src/style.css",
  "src/ui/clipboard.js",
  "src/ui/keymap.js",
  "src/ui/keypad.js",
  "src/ui/keys.js",
  "src/ui/status.js",
  "src/ui/text.js",
  "src/ui/toast.js",
  "data/keymap_words.txt",
  "data/ngram_model.txt",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
