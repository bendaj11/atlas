---
title: Why Atlas
description: Decide whether Atlas fits your product by comparing it with other ways to compose a frontend.
---

# Why Atlas

This page explains the problem Atlas addresses, what it adds on top of Native
Federation, and how it compares with other approaches. It is written for tech
leads and architects who need to decide whether to adopt Atlas.

## The problem

When many teams contribute to one web product, a single build and a single
release become a bottleneck:

- Every team waits for the slowest team's changes to be ready and tested.
- A defect in one feature blocks or rolls back everyone else's work.
- Rolling back means rebuilding and redeploying the whole product.
- Teams cannot upgrade their own code paths without coordinating with every
  other team.

A micro-frontend architecture splits the product into independently built
pieces that are composed in the browser. That solves the release bottleneck,
but it creates new questions: which version of each piece runs in which
environment, how the pieces find each other, how they share services such as
sign-in, how you roll one piece back, and how you stop one piece from breaking
the page.

Atlas answers those questions with a fixed model: a **Host** that owns the
page, **Apps** that own features, an immutable **artifact registry**, and
explicit **deployments** per environment.

## What Atlas adds on top of Native Federation

[Native Federation](glossary.md#native-federation) loads ES modules from
another build at runtime and shares libraries such as Angular or React between
builds. Atlas uses it for module loading and adds the parts around it:

| Concern                   | Native Federation alone                     | With Atlas                                                                                                                             |
| ------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Finding remote code       | You maintain a map of remote names to URLs. | The loader reads the environment's host deployment manifest; no App URL lives in Host code.                                            |
| Versions and environments | Not modeled.                                | `atlas publish` creates immutable versions; `atlas deploy` selects versions per environment; rollback is a deploy of an older version. |
| Integrity                 | Not checked.                                | The loader and runtime verify SHA-256 digests from the artifact manifest before running Host or App code.                              |
| Where an App appears      | You write the routing and mounting code.    | Apps declare routes and slots in `atlas.config.ts`; the runtime mounts them into host anchors.                                         |
| Host services             | You design your own contract.               | A typed SDK for HTTP, events, navigation, host data, and product-specific extensions.                                                  |
| Style and DOM isolation   | None.                                       | Each App mounts in its own Shadow DOM root by default.                                                                                 |
| Failure handling          | A failed import usually breaks the page.    | Retries, timeouts, per-App error states, and runtime events for monitoring.                                                            |
| Mixed frameworks          | Possible, but you write the adapters.       | Angular Hosts load React Apps and React Hosts load Angular Apps through built-in adapters.                                             |
| Local development         | You run and wire each dev server yourself.  | `npx atlas dev` runs a Host and Apps together; [Columbus](../guides/columbus.md) swaps versions on a deployed page.                    |
| Scaffolding               | Framework CLI only.                         | `npx atlas generate` creates Hosts, Apps, and widgets in Nx, Turborepo, package-manager workspaces, or standalone projects.            |

## Comparison with other approaches

### Raw Module Federation or Native Federation

Choose raw federation when you want full control and are ready to build the
registry, version selection, rollback, integrity checks, routing contract, and
failure handling yourself. Choose Atlas when you want those decisions made for
you and are comfortable with its conventions: static registry files, one Host
per page, and Apps declared through `atlas.config.ts`.

### single-spa

single-spa is a framework-agnostic router that mounts and unmounts
applications based on the URL. It leaves module loading, versioning, and
deployment to you. Atlas covers a similar lifecycle for Angular and React and
also defines publishing, deployment, integrity checks, and a typed Host SDK.
single-spa supports more frameworks; Atlas supports only Angular and React.

### Nx module federation

Nx provides generators and executors for Module Federation inside an Nx
workspace. It focuses on the build and on local development. Atlas works in Nx
workspaces too (it can delegate scaffolding to the Nx generators), and adds the
runtime registry, per-environment deployments, and the Host SDK. Atlas also
works without Nx.

### iframes

An iframe gives each feature a separate browsing context, which is the
strongest isolation a browser offers. It also makes shared layout, routing,
deep links, focus management, accessibility, and shared sign-in harder, and
every iframe loads its own copy of the framework. Atlas renders Apps in the same
document, which makes those concerns easier to handle but gives weaker
isolation. If you must run untrusted code, use iframes.

### Build-time composition

You can publish each feature as an npm package and compose them in one build.
This is the least complex option at runtime, and it gives the best
tree-shaking and type checking across features. The cost is that every feature
change needs a new build and release of the whole product. Choose it when
independent releases are not a requirement.

## When Atlas fits

Atlas is a good fit when:

- several teams contribute features to one product and want to release on their
  own schedules;
- you need to roll back one feature without redeploying the rest;
- your features are Angular or React, rendered on the client;
- you can serve static files from a CDN or object storage and control the
  headers of the Host's domain;
- you want one consistent contract between the page shell and features instead
  of per-team conventions.

## When Atlas does not fit

Consider another approach when:

- **One team owns the whole product.** The overhead of a registry, versioning,
  and deployments outweighs the benefit. A regular single-page application is
  simpler.
- **You need server-side rendering or static site generation for SEO.** Atlas
  supports client-side rendering only.
- **You need to run untrusted third-party code.** Apps run in the same
  JavaScript realm as the Host. Shadow DOM isolates markup and styles, not
  scripts. Anyone who can publish an App can run code on your pages. Use
  iframes for untrusted code.
- **You use Vue, Svelte, or another framework.** Atlas generators and adapters
  support Angular and React only.
- **You need a stable 1.0 API today.** Atlas is at version 0.x. Read
  [Compatibility](../reference/compatibility.md) for the current stability
  statement.

## Next steps

- [Overview](overview.md): the parts of Atlas and who owns them.
- [Architecture](architecture.md): how loading, releases, and failure
  isolation work.
- [Tutorial](../get-started/tutorial.md): try Atlas on your machine.
- [FAQ](../faq.md): answers to common adoption questions.
