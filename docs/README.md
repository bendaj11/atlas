---
title: Atlas documentation
description: Start here to find the right Atlas page, whether you are new to Atlas or looking up a specific contract.
---

# Atlas documentation

Atlas is a micro-frontend platform for Angular and React. These docs take you from your first local Host and App to production deployments, and then serve as a reference. If you are new, follow the learning path in order.

## Learning path

1. **Introduction.** Read the Overview to learn the parts of Atlas, and Why Atlas to decide whether it fits your product.
2. **Get started.** Follow the Tutorial to run a Host and an App on your machine in about 15 minutes.
3. **Concepts.** Learn what Hosts and Apps own and how routing, host anchors, and isolation work.
4. **Guides.** Build your Host or App with the React or Angular guides.
5. **Deploy.** Publish and deploy to real environments, starting with Production deployment.
6. **Reference.** Look up commands, APIs, and file formats.
7. **Help.** Use Troubleshooting and the FAQ when something does not work.

## Introduction

- [Overview](introduction/overview.md): the parts of Atlas and who owns them.
- [Why Atlas](introduction/why-atlas.md): the problem, the alternatives, and when Atlas fits.
- [Architecture](introduction/architecture.md): page loading, releases, failure isolation, and design decisions.
- [Glossary](introduction/glossary.md): every Atlas term.

## Get started

- [Tutorial](get-started/tutorial.md): create and run a Host and an App.
- [Generate a Host](get-started/generate-host.md): common ways to create a Host.
- [Generate an App](get-started/generate-app.md): common ways to create an App and connect it to a Host.

## Concepts

- [Hosts](concepts/hosts.md): what a Host owns.
- [Apps](concepts/apps.md): what an App owns.
- [Routing](concepts/routing.md): how Host routes and App inner routes work together.
- [Host anchors](concepts/host-anchors.md): route outlets, slots, navigation, and status.
- [Styles and isolation](concepts/styles-and-isolation.md): Shadow DOM, assets, and global styles.

## Guides

### React

- [Build a React Host](guides/react/host.md)
- [Build a React App](guides/react/app.md)
- [React project structure](guides/react/project-structure.md)
- [React routing](guides/react/routing.md)
- [React SDK](guides/react/sdk.md)
- [React assets and styles](guides/react/assets-and-styles.md)
- [React generators](guides/react/generators.md)
- [React examples](guides/react/examples.md)
- [React production deployment](guides/react/production-deployment.md)
- [React troubleshooting](guides/react/troubleshooting.md)

### Angular

- [Build an Angular Host](guides/angular/host.md)
- [Build an Angular App](guides/angular/app.md)
- [Angular project structure](guides/angular/project-structure.md)
- [Angular routing](guides/angular/routing.md)
- [Angular SDK](guides/angular/sdk.md)
- [Angular assets and styles](guides/angular/assets-and-styles.md)
- [Angular generators](guides/angular/generators.md)
- [Angular examples](guides/angular/examples.md)
- [Angular production deployment](guides/angular/production-deployment.md)
- [Angular troubleshooting](guides/angular/troubleshooting.md)

### All frameworks

- [Local development](guides/local-development.md): run Hosts and Apps with `npx atlas dev`.
- [Columbus](guides/columbus.md): switch App and Host versions on any Atlas page.
- [Share host data with Apps](guides/host-data.md): give Apps data such as the signed-in user.
- [Exported widgets](guides/exported-widgets.md): share UI between Apps.
- [Testing Apps and Hosts](guides/testing-apps-and-hosts.md): test against Atlas contracts with `@atlas/testkit`.
- [Workspaces and CI](guides/workspaces-and-ci.md): Nx, Turborepo, package manager workspaces, and pipelines.
- [PR previews](guides/pr-previews.md): publish and review preview builds.
- [Migrate an existing single-page app](guides/migrate-existing-spa.md): adopt Atlas one feature at a time.

## Deploy

- [Production deployment](deploy/production-deployment.md): build once, publish once, deploy many times.
- [Host bootstrap](deploy/bootstrap.md): the static page that starts a Host.
- [Security](deploy/security.md): headers, CSP, and trust boundaries.
- [Production readiness](deploy/production-readiness.md): verification, monitoring, and recovery.
- [Publish with Artifactory](deploy/artifactory.md): use JFrog Artifactory as the registry.
- [Governance](deploy/governance.md): run Atlas across many teams.

## Reference

- [CLI reference](reference/cli.md): every command and flag.
- [Configuration reference](reference/configuration.md): `atlas.config.ts`, `package.json` `atlas`, and `atlas.runtime.json`.
- [SDK reference](reference/sdk.md): the App-facing API.
- [Public API reference](reference/api.md): every public package entry point.
- [Manifests reference](reference/manifests.md): published artifact manifests, host deployment manifests, and the deployment state.
- [Registry reference](reference/registry.md): storage layout and registry files.
- [Errors reference](reference/errors.md): Atlas error codes.
- [Packages reference](reference/packages.md): what each `@atlas` package does.
- [Compatibility reference](reference/compatibility.md): how to get the packages, supported versions, and stability.

## Help

- [Troubleshooting](troubleshooting.md): common problems across frameworks.
- [FAQ](faq.md): short answers to adoption and operations questions.

## Contributing

To work on Atlas itself, read [Contributing](../CONTRIBUTING.md).
