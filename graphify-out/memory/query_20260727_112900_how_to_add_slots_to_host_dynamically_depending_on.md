---
type: "query"
date: "2026-07-27T11:29:00.276809+00:00"
question: "how to add slots to host dynamically depending on the route?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["host-slots.ts", "startAtlasHostRuntime()", "route-context.ts"]
---

# Q: how to add slots to host dynamically depending on the route?

## Answer

Expanded from original query via graph vocab: [slot, slots, route, routes, routing, router, host, hosts, outlet, placeholder, component, manifest]. Atlas slot placements mount once at host runtime startup, independently from route reconciliation. Keep every possible data-atlas-slot anchor mounted and toggle its parent visibility from host router state. Do not conditionally add/remove the anchor: a missing startup anchor is skipped, and later route changes only reconcile route placements. True route-scoped slot mount/unmount is not currently supported; use a routed app/widget composition or extend runtime slot reconciliation.

## Outcome

- Signal: useful

## Source Nodes

- host-slots.ts
- startAtlasHostRuntime()
- route-context.ts