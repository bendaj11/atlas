---
type: "query"
date: "2026-07-26T19:26:43.348291+00:00"
question: "I just wanted atlas not to be bound to specific minor version of pnpm but to a major version so if someone clones atlas and has pnpm 10.32.1 they wont have to upgrade"
contributor: "graphify"
outcome: "useful"
source_nodes: ["package.json"]
---

# Q: I just wanted atlas not to be bound to specific minor version of pnpm but to a major version so if someone clones atlas and has pnpm 10.32.1 they wont have to upgrade

## Answer

Expanded from original query via graph vocab: package, manager, pnpm, version, dev, workspace, release. Use devEngines.packageManager with name pnpm, version >=10 <11, and onFail error. Unlike legacy packageManager, devEngines accepts a semver range. Verified locally: pnpm 10.32.1 installs successfully; pnpm 11.10.0 is rejected. engines.pnpm may remain with same range but does not replace devEngines.packageManager for workspace resolution.

## Outcome

- Signal: useful

## Source Nodes

- package.json