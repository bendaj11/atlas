---
title: Atlas documentation
description: Start here to find the right Atlas page, whether you are new to Atlas or looking up a specific contract.
---

# Atlas documentation

Atlas is a micro-frontend platform for Angular and React. These docs take you
from your first local Host and App to production deployments, and then serve
as a reference. If you are new, follow the learning path in order.

## Learning path

1. **Introduction.** Read the [Overview](introduction/overview.md) to learn the
   parts of Atlas, and [Why Atlas](introduction/why-atlas.md) to decide whether
   it fits your product.
2. **Get started.** Follow the [Tutorial](get-started/tutorial.md) to run a Host
   and an App on your machine in about 15 minutes.
3. **Concepts.** Learn what [Hosts](concepts/hosts.md) and
   [Apps](concepts/apps.md) own and how routing, anchors, and isolation work.
4. **Guides.** Build your Host or App with the React or Angular guides.
5. **Deploy.** Publish and deploy to real environments, starting with
   [Production deployment](deploy/production-deployment.md).
6. **Reference.** Look up commands, APIs, and file formats.
7. **Help.** Use Troubleshooting and the FAQ when something does not work.

## Introduction

- [Overview](introduction/overview.md): the parts of Atlas and who owns them.
- [Why Atlas](introduction/why-atlas.md): the problem, the alternatives, and
  when Atlas fits.
- [Architecture](introduction/architecture.md): page loading, releases,
  failure isolation, and design decisions.
- [Glossary](introduction/glossary.md): every Atlas term.

## Get started

- [Tutorial](get-started/tutorial.md): create and run a Host and an App.
- [Generate a Host](get-started/generate-host.md): options and generated files.
- [Generate an App](get-started/generate-app.md): options and generated files.

## Concepts

- [Hosts](concepts/hosts.md): what a Host owns.
- [Apps](concepts/apps.md): what an App owns.
- [Routing](concepts/routing.md): how Host routes and App inner routes work
  together.
- [Host anchors](concepts/host-anchors.md): route outlets, slots, navigation,
  and status.
- [Styles and isolation](concepts/styles-and-isolation.md): Shadow DOM, assets,
  and global styles.

## Guides

### React

- [Build a React Host](guides/react/host.md)
- [Build a React App](guides/react/app.md)
- [Project structure](guides/react/project-structure.md)
- [Routing](guides/react/routing.md)
- [SDK](guides/react/sdk.md)
- [Assets and styles](guides/react/assets-and-styles.md)
- [Generators](guides/react/generators.md)
- [Examples](guides/react/examples.md)
- [Production deployment](guides/react/production-deployment.md)
- [Troubleshooting](guides/react/troubleshooting.md)

### Angular

- [Build an Angular Host](guides/angular/host.md)
- [Build an Angular App](guides/angular/app.md)
- [Project structure](guides/angular/project-structure.md)
- [Routing](guides/angular/routing.md)
- [SDK](guides/angular/sdk.md)
- [Assets and styles](guides/angular/assets-and-styles.md)
- [Generators](guides/angular/generators.md)
- [Examples](guides/angular/examples.md)
- [Production deployment](guides/angular/production-deployment.md)
- [Troubleshooting](guides/angular/troubleshooting.md)

### All frameworks

- [Local development](guides/local-development.md): run Hosts and Apps with
  `npx atlas dev`.
- [Columbus](guides/columbus.md): switch App and Host versions on any Atlas
  page.
- [Host data](guides/host-data.md): share data from the Host with Apps.
- [Exported widgets](guides/exported-widgets.md): share UI between Apps.
- [Testing Apps and Hosts](guides/testing-apps-and-hosts.md): test against
  Atlas contracts with `@atlas/testkit`.
- [Workspaces and CI](guides/workspaces-and-ci.md): Nx, Turborepo, package
  manager workspaces, and pipelines.
- [Pull-request previews](guides/pr-previews.md): publish and review preview
  builds.

## Deploy

- [Production deployment](deploy/production-deployment.md): build once,
  publish once, deploy many times.
- [Bootstrap](deploy/bootstrap.md): the static page that starts a Host.
- [Security](deploy/security.md): headers, CSP, and trust boundaries.
- [Production readiness](deploy/production-readiness.md): verification,
  monitoring, and recovery.
- [Artifactory](deploy/artifactory.md): use JFrog Artifactory as the registry.
- [Governance](deploy/governance.md): run Atlas across many teams.

## Reference

- [CLI](reference/cli.md): every command and flag.
- [Configuration](reference/configuration.md): `atlas.config.ts`,
  `package.json` `atlas`, and `atlas.runtime.json`.
- [SDK](reference/sdk.md): the App-facing API.
- [API](reference/api.md): every public package entry point.
- [Manifests](reference/manifests.md): artifact, host, and deployment manifest
  formats.
- [Registry](reference/registry.md): storage layout and registry files.
- [Errors](reference/errors.md): Atlas error codes.
- [Packages](reference/packages.md): what each `@atlas` package does.
- [Compatibility](reference/compatibility.md): supported versions and
  stability.

## Help

- [Troubleshooting](troubleshooting.md): common problems across frameworks.
- [FAQ](faq.md): short answers to adoption and operations questions.

## Contributing

To work on Atlas itself, read [Contributing](../CONTRIBUTING.md).
