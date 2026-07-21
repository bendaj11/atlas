---
type: "query"
date: "2026-07-21T19:37:51.864062+00:00"
question: "why am I seeing this error in columbus: Could not apply override; Custom URL must use localhost, 127.0.0.1, or [::1]."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Columbus", "validatedBaseUrl", "isLoopbackHostname", "OverridesSelectionForm"]
---

# Q: why am I seeing this error in columbus: Could not apply override; Custom URL must use localhost, 127.0.0.1, or [::1].

## Answer

Expanded from original query via graph vocab: [columbus, override, custom, url, localhost, loopback, host, validation, apply, extension]. Columbus validates Custom URL as local-development-only. Parsed hostname must exactly equal localhost, 127.0.0.1, or [::1]; names such as 0.0.0.0, LAN IPs, machine names, and remote domains are rejected. Use an absolute HTTP(S) loopback base URL such as http://localhost:4201. Columbus appends /remoteEntry.json itself.

## Outcome

- Signal: useful

## Source Nodes

- Columbus
- validatedBaseUrl
- isLoopbackHostname
- OverridesSelectionForm