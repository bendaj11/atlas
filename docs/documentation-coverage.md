# Documentation Coverage

Atlas docs must make every supported user-facing capability discoverable from
[documentation navigation](README.md). This inventory is review checklist, not
substitute for source-of-truth references.

## Coverage Inventory

| Product surface                             | Canonical documentation                                                          | Source of truth                  |
| ------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------- |
| Install, first Host, first App              | [Getting Started](getting-started.md)                                            | Package installation and CLI     |
| `atlas g host`                              | [Generate a Host](host/generate.md)                                              | `atlas g host --help`            |
| `atlas g app`                               | [Generate an App](app/generate.md)                                               | `atlas g app --help`             |
| `atlas g widget`                            | [Exported widgets](exported-widgets.md)                                          | `atlas g widget --help`          |
| Local host and app workflows                | [Local development](local-development.md)                                        | `atlas dev --help`               |
| Build, bootstrap, runtime config            | [Bootstrap](bootstrap.md)                                                        | CLI help and generated output    |
| Publish, deployment, previews, verification | [Production deployment](production-deployment.md), [PR previews](pr-previews.md) | CLI help and schemas             |
| Host and App configuration                  | [Host](host.md), [App](app.md), framework guides                                 | TypeScript declarations          |
| Routing and navigation                      | Framework routing guides                                                         | SDK declarations                 |
| SDK, runtime, adapters, testkit             | [SDK](sdk.md), [Public API](api.md)                                              | Package exports and declarations |
| Manifests and registry                      | [Manifest](manifest.md), [Registry](registry.md)                                 | Schema declarations              |
| Security, recovery, failures                | [Security](security.md), [Troubleshooting](troubleshooting.md)                   | Runtime and CLI behavior         |

## Change Gate

When public behavior changes, update in same change:

1. User journey page for affected Host, App, operations workflow.
2. Feature page with scenario, example, expected result, relevant API table.
3. Canonical CLI, type, or schema reference.
4. Documentation navigation and this inventory when surface is new.
5. Relative links and commands against source or `--help`.

> [!warning]
> Do not publish public feature with generated API reference only. Reader needs
> discoverable task page and working example before exhaustive lookup.
