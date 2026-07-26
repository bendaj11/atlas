---
type: "query"
date: "2026-07-26T19:22:46.501102+00:00"
question: "when running pnpm release:publish --access public im getting error Could not resolve workspace. Missing devEngines.packageManager or legacy packageManager field in package.json"
contributor: "graphify"
outcome: "useful"
source_nodes: ["package.json", "publish-release.js"]
---

# Q: when running pnpm release:publish --access public im getting error Could not resolve workspace. Missing devEngines.packageManager or legacy packageManager field in package.json

## Answer

Expanded from original query via graph vocab: package, manager, pnpm, publish, release, workspace, dev. Root package.json removed packageManager pnpm@10.34.4 and added engines.pnpm. engines.pnpm constrains compatibility but does not identify or select the package manager. Restore packageManager pnpm@10.34.4, or use devEngines.packageManager object with name pnpm and exact version. Existing project and Corepack setup favor restoring legacy packageManager.

## Outcome

- Signal: useful

## Source Nodes

- package.json
- publish-release.js