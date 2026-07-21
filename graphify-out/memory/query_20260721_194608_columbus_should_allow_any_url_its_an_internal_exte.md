---
type: "query"
date: "2026-07-21T19:46:08.999634+00:00"
question: "columbus should allow any url its an internal extension"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Columbus", "manifest-utils.ts", "validatedBaseUrl"]
---

# Q: columbus should allow any url its an internal extension

## Answer

Expanded via graph vocab: [columbus, override, custom, url, allow, remote, http, host, manifest, validation]. Removed loopback hostname allowlist from validatedBaseUrl. Columbus now accepts arbitrary absolute HTTP(S) custom base URLs while still rejecting unsupported schemes, embedded credentials, query parameters, and fragments. Added remote HTTPS regression coverage and updated Columbus/local-development docs. Host CSP must permit remote asset origin.

## Outcome

- Signal: useful

## Source Nodes

- Columbus
- manifest-utils.ts
- validatedBaseUrl