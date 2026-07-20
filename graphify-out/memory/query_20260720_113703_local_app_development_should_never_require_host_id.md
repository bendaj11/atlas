---
type: "query"
date: "2026-07-20T11:37:03.996118+00:00"
question: "Local app development should never require host id; user supplies only launch URL."
contributor: "graphify"
outcome: "useful"
source_nodes: ["runApp()", "loadHostRuntimeConfig()", "AtlasHostRuntimeConfig", "AtlasRuntimeOverrideDocument"]
---

# Q: Local app development should never require host id; user supplies only launch URL.

## Answer

Expanded via graph vocab: [app, host, url, runtime, identity, route, target, origin, manifest, configuration]. Desired CLI contract: atlas dev app --host-url=<page>. Atlas opens URL, resolves its origin, loads public /atlas.runtime.json, derives hostId, validates app has a placement for that host, builds the override document, and launches exact requested page. Remove --host and ATLAS_HOST_ID from app dev user configuration. Host IDs remain internal manifest/catalog identities, but users never select them for local launch. Failure should report that URL is not a valid Atlas host, or that app has no placement for discovered host.

## Outcome

- Signal: useful

## Source Nodes

- runApp()
- loadHostRuntimeConfig()
- AtlasHostRuntimeConfig
- AtlasRuntimeOverrideDocument