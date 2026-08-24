# Atlas Documentation

Read these docs in the order that matches your work: learn what Atlas does,
create your first projects, then build a Host or an App. Each guide explains a
task in plain language, shows common examples, and links to exact API details.

## What Is Atlas?

- [Atlas overview](overview.md) — what Atlas solves and the names of its main parts.
- [Architecture](architecture.md) — how Atlas loads Apps and publishes changes.
- Supported scope: Angular and React hosts/apps, client-side rendering, static
  browser-readable registries, exported widgets, and explicit publication adapters.

## Getting Started

Start here. Install Atlas and create a host and app. No storage, CI, or
production deployment required.

- [Install and generate first projects](getting-started.md)
- [Generate an Atlas Host](host/generate.md)
- [Generate an Atlas App](app/generate.md)

- [Atlas Host](host.md) — main application page, navigation, and shared services.
- [Atlas App](app.md) — feature application shown inside a Host.

## Atlas Host

A Host is the main application page that users open. It provides page layout, top-level
navigation, shared services such as authentication, and startup files.

- [Host overview](host.md)
- [Generate a Host](host/generate.md)
- [Build Angular Host](angular/host-getting-started.md)
- [Build React Host](react/host-getting-started.md)
- [Routing and navigation](angular/routing.md) / [React routing](react/routing.md)
- [SDK and host services](angular/sdk.md) / [React SDK](react/sdk.md)
- [Assets and styles](angular/assets-and-styles.md) / [React assets and styles](react/assets-and-styles.md)
- [Local development](local-development.md)
- [Host bootstrap and discovery](bootstrap.md)
- [Host deployment](production-deployment.md)
- [Troubleshooting](troubleshooting.md)

## Atlas App

An App is a feature shown inside a Host. It owns its UI, its own screens,
configuration, reusable widgets, and releases.

- [App overview](app.md)
- [Generate an App](app/generate.md)
- [Build Angular App](angular/app-getting-started.md)
- [Build React App](react/app-getting-started.md)
- [Routing and navigation](angular/routing.md) / [React routing](react/routing.md)
- [SDK and host services](angular/sdk.md) / [React SDK](react/sdk.md)
- [Assets and styles](angular/assets-and-styles.md) / [React assets and styles](react/assets-and-styles.md)
- [Exported widgets](exported-widgets.md)
- [Consumer testing](consumer-testing.md)
- [Local development](local-development.md)
- [Publish and deploy](production-deployment.md)
- [Troubleshooting](troubleshooting.md)

## Deploy And Operate

- [Build once, publish once, deploy many](production-deployment.md)
- [Registry and storage](registry.md)
- [Host bootstrap](bootstrap.md)
- [Workspace and CI integration](workspaces.md)
- [Pull-request previews](pr-previews.md)
- [Production readiness](production-readiness.md)
- [Security](security.md)

## Reference

- [CLI and generator reference](generators.md)
- [Public TypeScript API](api.md)
- [SDK reference](sdk.md)
- [Manifest reference](manifest.md)
- [Registry reference](registry.md)
- [Examples](examples.md)

## Help And Project

- [Troubleshooting](troubleshooting.md)
- [Contributing](../CONTRIBUTING.md)
- [Repository testing](testing.md)
- [Releasing Atlas packages](releasing.md)
- [Documentation standards](documentation-guide.md)
- [Documentation coverage](documentation-coverage.md)
