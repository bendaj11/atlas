---
title: Documentation coverage
description: Find the page that documents each Atlas product surface and learn what to update when public behavior changes.
---

# Documentation coverage

This page maps every supported, user-facing Atlas capability to the page that documents it. It is a review checklist for contributors; it does not replace the reference pages or the code they describe. Every page listed here must be reachable from [the documentation home](../docs/README.md).

## Coverage inventory

The "Verify against" column names the code or command that a reviewer checks when the page changes.

| Product surface                                  | Canonical documentation                                                                                                                    | Verify against                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| What Atlas is and when to use it                 | [Overview](../docs/introduction/overview.md), [Why Atlas](../docs/introduction/why-atlas.md), [Glossary](../docs/introduction/glossary.md) | `packages/*` public exports                                    |
| How Atlas loads, publishes, and isolates Apps    | [Architecture](../docs/introduction/architecture.md)                                                                                       | `packages/runtime`, `packages/bootstrap`, `packages/cli`       |
| Installation and the first Host and App          | [Tutorial](../docs/get-started/tutorial.md)                                                                                                | `packages/cli/package.json`, `npx atlas generate --help`       |
| `npx atlas generate host`                        | [Generate a host](../docs/get-started/generate-host.md)                                                                                    | `npx atlas generate host --help`, `packages/generators`        |
| `npx atlas generate app`                         | [Generate an app](../docs/get-started/generate-app.md)                                                                                     | `npx atlas generate app --help`, `packages/generators`         |
| `npx atlas generate widget` and exported widgets | [Exported widgets](../docs/guides/exported-widgets.md)                                                                                     | `npx atlas generate widget --help`                             |
| Hosts, Apps, routing, host anchors, and styles   | [Concepts](../docs/concepts/hosts.md) pages and the framework guides in `docs/guides/react/` and `docs/guides/angular/`                    | `packages/runtime`, `packages/sdk`, generator output           |
| Host data                                        | [Host data](../docs/guides/host-data.md)                                                                                                   | `packages/sdk`, `packages/runtime`                             |
| Local development and previews                   | [Local development](../docs/guides/local-development.md), [Columbus](../docs/guides/columbus.md)                                           | `npx atlas dev --help`, `apps/columbus`                        |
| Testing Hosts and Apps                           | [Testing apps and hosts](../docs/guides/testing-apps-and-hosts.md)                                                                         | `packages/testkit` exports                                     |
| Workspaces, CI, and pull request previews        | [Workspaces and CI](../docs/guides/workspaces-and-ci.md), [PR previews](../docs/guides/pr-previews.md)                                     | `npx atlas publish --help`, `npx atlas remove-preview --help`  |
| Bootstrap and runtime configuration              | [Bootstrap](../docs/deploy/bootstrap.md)                                                                                                   | `npx atlas bootstrap --help`, `packages/bootstrap`             |
| Publish, deploy, verify, and roll back           | [Production deployment](../docs/deploy/production-deployment.md), [Production readiness](../docs/deploy/production-readiness.md)           | `npx atlas deploy --help`, `npx atlas verify --help`           |
| Security and multi-team governance               | [Security](../docs/deploy/security.md), [Governance](../docs/deploy/governance.md)                                                         | Runtime and CLI behavior                                       |
| Artifactory storage                              | [Artifactory](../docs/deploy/artifactory.md)                                                                                               | `packages/cli/src/publication/`                                |
| CLI commands, flags, and environment variables   | [CLI reference](../docs/reference/cli.md)                                                                                                  | `packages/cli/src/help/content/`, `npx atlas <command> --help` |
| Configuration files                              | [Configuration reference](../docs/reference/configuration.md)                                                                              | `packages/schema` configuration types                          |
| SDK and public package APIs                      | [SDK reference](../docs/reference/sdk.md), [API reference](../docs/reference/api.md), [Packages](../docs/reference/packages.md)            | Package `exports` and TypeScript declarations                  |
| Manifests and registry layout                    | [Manifests](../docs/reference/manifests.md), [Registry](../docs/reference/registry.md)                                                     | `packages/schema` declarations                                 |
| Error codes                                      | [Errors](../docs/reference/errors.md)                                                                                                      | `AtlasError` codes in `packages/*`                             |
| Supported versions and stability                 | [Compatibility](../docs/reference/compatibility.md)                                                                                        | `package.json` `engines` and `peerDependencies`                |
| Failures and fixes                               | [Troubleshooting](../docs/troubleshooting.md), [FAQ](../docs/faq.md), and the framework troubleshooting pages                              | Runtime and CLI error messages                                 |

## Change gate

When public behavior changes, update the following in the same pull request:

1. The task page for the affected Host, App, or operations workflow.
2. The feature guide, including a scenario, a working example, an expected result, and a short API table for the APIs it introduces.
3. The canonical reference page for the CLI, configuration, types, or schema, as listed in [the documentation guide](documentation-guide.md#keep-one-source-of-truth).
4. The documentation home and this inventory when the change adds a new surface.
5. Links and commands, checked with `pnpm verify:docs` and against the source or `npx atlas <command> --help`.

> **Warning:** Do not ship a public feature that only has reference documentation. A reader needs a discoverable task page and a working example before they need an exhaustive lookup table.

## Related

- [Documentation guide](documentation-guide.md) defines the page structure, voice, and verification rules.
