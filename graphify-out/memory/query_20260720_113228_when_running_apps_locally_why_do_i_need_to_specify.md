---
type: "query"
date: "2026-07-20T11:32:28.471655+00:00"
question: "when running apps locally why do I need to specify both host url and id? isn't url enough?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["AtlasDevService", "resolveHostId()", "resolveHostUrl()", "startOwnedControlServer", "AtlasRouteMount"]
---

# Q: when running apps locally why do I need to specify both host url and id? isn't url enough?

## Answer

Expanded from original query via graph vocab: [app, host, url, identity, local, catalog, manifest, configuration, origin]. Host URL and host ID serve different roles. URL is browser navigation target, including route path. ID is stable logical host identity used to select app placements, namespace the override document and control-server sessions, and validate that the catalog/override belongs to the intended host. URL cannot reliably provide that identity because a CLI fetch may lack browser authentication and one origin may expose multiple paths or deployments. In current CLI, --host is usually unnecessary when app config declares exactly one host; resolveHostId infers it. It is required only when zero or multiple host IDs are configured. --host-url remains necessary unless supplied through ATLAS_HOST_URL or interactive prompt.

## Outcome

- Signal: useful

## Source Nodes

- AtlasDevService
- resolveHostId()
- resolveHostUrl()
- startOwnedControlServer
- AtlasRouteMount