---
type: "query"
date: "2026-07-20T11:41:16.249997+00:00"
question: "how can I serve columbus locally so I can develop without the need to rebuild and install every time"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Local development and Columbus", "Run a local app", "package.json"]
---

# Q: how can I serve columbus locally so I can develop without the need to rebuild and install every time

## Answer

Expanded from original query via graph vocab: [columbus, extension, dev, development, serve, watch, build, install, host, local, chrome]. Columbus is a Manifest V3 extension, so it cannot be served like a normal Vite web app. Load apps/columbus/dist as an unpacked extension once. Run Vite in build watch mode, then run scripts/copy-static.js once after the watcher's initial build because emptyOutDir removes manifest.json and icons. Source edits rebuild automatically; click Reload on chrome://extensions when Chrome must refresh extension contexts. Current package.json has no dev script. Requires Node version supported by Vite 7 (20.19+ or 22.12+).

## Outcome

- Signal: useful

## Source Nodes

- Local development and Columbus
- Run a local app
- package.json