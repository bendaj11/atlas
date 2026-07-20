---
type: "query"
date: "2026-07-20T11:34:22.893146+00:00"
question: "Can Atlas infer host id from a configured host URL when an app declares multiple hosts?"
contributor: "graphify"
outcome: "corrected"
correction: "Host URL can normally determine hostId by fetching the public /atlas.runtime.json. Authentication is not a valid general objection because Atlas documents this runtime configuration as public browser data."
source_nodes: ["resolveHostId()", "resolveHostUrl()", "loadHostRuntimeConfig()", "AtlasHostRuntimeConfig"]
---

# Q: Can Atlas infer host id from a configured host URL when an app declares multiple hosts?

## Answer

Expanded via graph vocab: [host, url, runtime, identity, route, config, resolve, target, fetch, origin, manifest]. Yes in normal online development. Given host URL, Atlas can fetch origin /atlas.runtime.json, validate it, read hostId, and confirm that ID exists among app placements. Runtime config is documented public browser data and contains hostId. Current CLI resolves hostId before hostUrl, so it cannot perform this inference; requiring both is an implementation limitation. Explicit host ID remains useful as an override and for offline or prepare-only operation when URL is unavailable. Full URL should resolve first; explicit ID wins, otherwise runtime discovery, then validation and route selection.

## Outcome

- Signal: corrected
- Correction: Host URL can normally determine hostId by fetching the public /atlas.runtime.json. Authentication is not a valid general objection because Atlas documents this runtime configuration as public browser data.

## Source Nodes

- resolveHostId()
- resolveHostUrl()
- loadHostRuntimeConfig()
- AtlasHostRuntimeConfig