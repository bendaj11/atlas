# Atlas Documentation

Read these docs in the order that matches your work: learn what Atlas does,
create your first projects, then build a Host or an App. Each guide explains a
task in plain language, shows common examples, and links to exact API details.

## What Is Atlas?

- [Atlas overview](introduction/overview.md) — what Atlas solves and the names of its main parts.
- [Architecture](introduction/architecture.md) — how Atlas loads Apps and publishes changes.
- Supported scope: Angular and React hosts/apps, client-side rendering, static
  browser-readable registries, exported widgets, and explicit publication adapters.

## Getting Started

Start here. Install Atlas and create a host and app. No storage, CI, or
production deployment required.

- [Install and generate first projects](get-started/tutorial.md)
- [Generate an Atlas Host](get-started/generate-host.md)
- [Generate an Atlas App](get-started/generate-app.md)

- [Atlas Host](concepts/hosts.md) — main application page, navigation, and shared services.
- [Atlas App](concepts/apps.md) — feature application shown inside a Host.

## Atlas Host

A Host is the main application page that users open. It provides page layout, top-level
navigation, shared services such as authentication, and startup files.

- [Host overview](concepts/hosts.md)
- [Generate a Host](get-started/generate-host.md)
- [Build Angular Host](guides/angular/host.md)
- [Build React Host](guides/react/host.md)
- [Routing and navigation](guides/angular/routing.md) / [React routing](guides/react/routing.md)
- [SDK and host services](guides/angular/sdk.md) / [React SDK](guides/react/sdk.md)
- [Assets and styles](guides/angular/assets-and-styles.md) / [React assets and styles](guides/react/assets-and-styles.md)
- [Local development](guides/local-development.md)
- [Host bootstrap and discovery](deploy/bootstrap.md)
- [Host deployment](deploy/production-deployment.md)
- [Troubleshooting](troubleshooting.md)

## Atlas App

An App is a feature shown inside a Host. It owns its UI, its own screens,
configuration, reusable widgets, and releases.

- [App overview](concepts/apps.md)
- [Generate an App](get-started/generate-app.md)
- [Build Angular App](guides/angular/app.md)
- [Build React App](guides/react/app.md)
- [Routing and navigation](guides/angular/routing.md) / [React routing](guides/react/routing.md)
- [SDK and host services](guides/angular/sdk.md) / [React SDK](guides/react/sdk.md)
- [Assets and styles](guides/angular/assets-and-styles.md) / [React assets and styles](guides/react/assets-and-styles.md)
- [Exported widgets](guides/exported-widgets.md)
- [Consumer testing](guides/testing-apps-and-hosts.md)
- [Local development](guides/local-development.md)
- [Publish and deploy](deploy/production-deployment.md)
- [Troubleshooting](troubleshooting.md)

## Deploy And Operate

- [Build once, publish once, deploy many](deploy/production-deployment.md)
- [Registry and storage](reference/registry.md)
- [Host bootstrap](deploy/bootstrap.md)
- [Workspace and CI integration](guides/workspaces-and-ci.md)
- [Pull-request previews](guides/pr-previews.md)
- [Production readiness](deploy/production-readiness.md)
- [Security](deploy/security.md)

## Reference

- [CLI and generator reference](reference/cli.md)
- [Public TypeScript API](reference/api.md)
- [SDK reference](reference/sdk.md)
- [Manifest reference](reference/manifests.md)
- [Registry reference](reference/registry.md)
- [Examples](examples.md)

## Help And Project

- [Troubleshooting](troubleshooting.md)
- [Contributing](../CONTRIBUTING.md)
- [Repository testing](../contributing/testing.md)
- [Releasing Atlas packages](../contributing/releasing.md)
- [Documentation standards](../contributing/documentation-guide.md)
- [Documentation coverage](../contributing/documentation-coverage.md)
