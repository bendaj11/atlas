---
type: "query"
date: "2026-07-20T11:47:17.080303+00:00"
question: "Remove host ID input from atlas dev app and derive target from launch URL."
contributor: "graphify"
outcome: "useful"
source_nodes: ["AtlasDevService", "resolveHostId()", "loadHostRuntimeConfig()", "AtlasHostRuntimeConfig"]
---

# Q: Remove host ID input from atlas dev app and derive target from launch URL.

## Answer

Implemented URL-only app development. atlas dev reads --host-url or ATLAS_HOST_URL, infers a sole configured host or a uniquely matching route, and otherwise loads the page origin public /atlas.runtime.json to discover hostId. Discovered identities are validated against app placements, wildcard apps are supported, and only ATLAS_HOST_URL is saved. Removed --host and ATLAS_HOST_ID from dev help, docs, unit/integration commands, and e2e launch. Added runtime discovery and unsupported-host tests. CLI typecheck passed; focused Jest suites passed 31 tests with 7 environment-gated skips. graphify update completed with no topology changes.

## Outcome

- Signal: useful

## Source Nodes

- AtlasDevService
- resolveHostId()
- loadHostRuntimeConfig()
- AtlasHostRuntimeConfig