---
title: FAQ
description: Short answers to common questions about adopting, running, and operating Atlas.
---

# FAQ

This page answers questions that come up when teams evaluate or adopt Atlas. Each answer links to the page with the full details.

## Adoption

### What is Atlas, in one sentence?

Atlas is a micro-frontend platform that lets teams build Angular and React features as separate Apps, release them independently, and compose them into one Host page in the browser. See [Overview](introduction/overview.md).

### Is Atlas ready for production?

Atlas is at version 0.x. Breaking changes can happen between minor versions before 1.0. Read the [Compatibility reference](reference/compatibility.md) for the current stability statement and the [changelog](../CHANGELOG.md) before you upgrade.

### When should I not use Atlas?

When one team owns the whole product, when you need server-side rendering, when you need to run untrusted third-party code, or when you use a framework other than Angular or React. See [Why Atlas](introduction/why-atlas.md#when-atlas-does-not-fit).

### Where do I get the Atlas packages?

The `@atlas` packages are not on the public npm registry. Install them from your organization's registry, or build them from source; [Get the packages](reference/compatibility.md#get-the-packages) describes both paths.

### Do I need Nx or a monorepo?

No. Atlas works in a standalone project with one `package.json`, in npm, pnpm, or Yarn workspaces, in Turborepo, and in Nx. Hosts and Apps can also live in separate repositories, because they only meet through the registry. See [Workspaces and CI](guides/workspaces-and-ci.md).

### Can an Angular Host show a React App?

Yes. An Angular Host can mount React Apps and a React Host can mount Angular Apps. The page then loads both frameworks, which costs startup time. See [Architecture](introduction/architecture.md#performance-and-startup-cost).

### Does Atlas support Vue or server-side rendering?

No. Atlas supports client-side rendering with Angular and React only.

### Can I adopt Atlas in an existing application?

Yes, one feature at a time. Atlas has no automated migration tool: you wrap the existing single-page app as one App at `/` and then move features into their own Apps. See [Migrate an existing single-page app](guides/migrate-existing-spa.md).

## Development

### Do I need Columbus to develop locally?

No. When you run a Host and an App with `npx atlas dev` on the same machine, the local Host page finds the local App through the [development session](introduction/glossary.md#development-session). You need [Columbus](guides/columbus.md) only to load a local or pull-request build into a Host that is deployed somewhere else, such as staging.

### Why does `npx atlas dev` say `atlas.previews is required`?

An App does not know which Host page to open. Add the Host URL to the `atlas.previews` list in the App's `package.json`, for example `"previews": ["http://localhost:4200"]`. See [Local development](guides/local-development.md#configure-previews).

### How do Apps talk to the Host or to each other?

Through the SDK. Its core gives every App the Host ID, host data, `navigateTo` for navigation to other Apps, a typed event bus, and `getWidget` for exported widgets. Atlas has no built-in HTTP client; a Host can add services such as an authenticated HTTP client as a Host-defined SDK extension. Apps never import each other's code; they can share UI through [exported widgets](guides/exported-widgets.md). See [Share host data with Apps](guides/host-data.md) and the [SDK reference](reference/sdk.md).

### Is Shadow DOM mandatory?

No. It is the default. Set `domIsolation: 'shared-dom'` in an App's `atlas.config.ts` to render it in the normal document. See [Styles and isolation](concepts/styles-and-isolation.md).

## Releases and operations

### Does publishing make a version live?

No. The `publish` command only stores an immutable version. Users see it after you run `npx atlas deploy` for an environment. See [Production deployment](deploy/production-deployment.md).

### How do I roll back?

Deploy the previous version: `npx atlas deploy <artifact> --to production --version <previous-version>`. Deploy rewrites only small JSON files, so a rollback does not rebuild or upload anything. See [Architecture](introduction/architecture.md#how-publish-deploy-and-rollback-work).

### Do I need a server to run Atlas?

No. The registry is static files, and the Host is served as static files. Your platform must serve `atlas.runtime.json` and the right security headers from the Host's domain. See [Host bootstrap](deploy/bootstrap.md) and [Security](deploy/security.md).

### Which storage can I use?

Atlas includes an S3-compatible storage adapter and an Artifactory mode. You can supply another storage implementation through the `storage` field of an `atlas.registry.ts` file. See the [Registry reference](reference/registry.md) and [Publish with Artifactory](deploy/artifactory.md).

### What happens when an App fails to load?

The runtime retries, then marks only that App as failed and shows the Host's error UI in its place. The Host and other Apps keep working. See [Architecture](introduction/architecture.md#how-failures-stay-contained).

### Can an App break the whole page?

Its markup and styles are isolated, but its JavaScript runs in the same page as everything else. Anyone who can publish an App can run code on your Host's pages, so treat publish access like production code access. See [Security](deploy/security.md) and [Governance](deploy/governance.md).

## Related

- [Glossary](introduction/glossary.md)
- [Troubleshooting](troubleshooting.md)
