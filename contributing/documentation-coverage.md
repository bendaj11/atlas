# Documentation Coverage

Atlas docs must make every supported user-facing capability discoverable from
[documentation navigation](../docs/README.md). This inventory is review checklist, not
substitute for source-of-truth references.

## Coverage Inventory

| Product surface                             | Canonical documentation                                                          | Source of truth                  |
| ------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------- |
| Install, first Host, first App              | [Getting Started](../docs/get-started/tutorial.md)                                            | Package installation and CLI     |
| `atlas g host`                              | [Generate a Host](../docs/get-started/generate-host.md)                                              | `atlas g host --help`            |
| `atlas g app`                               | [Generate an App](../docs/get-started/generate-app.md)                                               | `atlas g app --help`             |
| `atlas g widget`                            | [Exported widgets](../docs/guides/exported-widgets.md)                                          | `atlas g widget --help`          |
| Local host and app workflows                | [Local development](../docs/guides/local-development.md)                                        | `atlas dev --help`               |
| Build, bootstrap, runtime config            | [Bootstrap](../docs/deploy/bootstrap.md)                                                        | CLI help and generated output    |
| Publish, deployment, previews, verification | [Production deployment](../docs/deploy/production-deployment.md), [PR previews](../docs/guides/pr-previews.md) | CLI help and schemas             |
| Host and App configuration                  | [Host](../docs/concepts/hosts.md), [App](../docs/concepts/apps.md), framework guides                                 | TypeScript declarations          |
| Routing and navigation                      | Framework routing guides                                                         | SDK declarations                 |
| SDK, runtime, adapters, testkit             | [SDK](../docs/reference/sdk.md), [Public API](../docs/reference/api.md)                                              | Package exports and declarations |
| Manifests and registry                      | [Manifest](../docs/reference/manifests.md), [Registry](../docs/reference/registry.md)                                 | Schema declarations              |
| Security, recovery, failures                | [Security](../docs/deploy/security.md), [Troubleshooting](../docs/troubleshooting.md)                   | Runtime and CLI behavior         |

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
