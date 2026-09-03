---
type: "query"
date: "2026-09-02T16:32:34.315983+00:00"
question: "why atlas declares support for node <23? im using it with 24 and it works fine"
contributor: "graphify"
outcome: "useful"
source_nodes: ["engines", "node", "package.json", "README.md"]
---

# Q: why atlas declares support for node <23? im using it with 24 and it works fine

## Answer

Graph query terms: engines, node. Verified source and history: commit 5e9fc45 on 2026-08-23 changed package engines from >=20 to >=22.12.0 <23, introduced .nvmrc 22.23.2, and removed Node >=24.0.0 from README requirements. Current verify and release workflows use .nvmrc. No explicit Node 24 incompatibility rationale found in inspected commit or docs, and no runtime Node-version guard found in packages/scripts search. Inference: support range was narrowed to the Node 22 CI baseline; Node 24 working is consistent with this. Widening declared support should include Node 24 CI validation.

## Outcome

- Signal: useful

## Source Nodes

- engines
- node
- package.json
- README.md