---
title: Governance
description: How to run Atlas across many teams, covering ownership, publish permissions, shared dependencies, host SDK changes, route conflicts, and incremental adoption.
---

# Governance

This page helps tech leads and platform owners run Atlas when several teams release apps independently into shared hosts. It separates what Atlas enforces today from practices we recommend. Sections marked **Recommended practice** describe process, not product behavior.

## Who owns what

| Owner         | Owns                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Host team     | The host project, its layout and [host anchors](../concepts/host-anchors.md), the host SDK services, the bootstrap, and the host CSP. |
| App teams     | Their app projects, routes, slots, exported widgets, and release versions.                                                            |
| Platform team | Registry storage, CI identities, the publication lock, CDN configuration, `atlas.runtime.json`, and monitoring.                       |

## Publish and deploy permissions

Atlas has no per-team access control. Any identity that can write to the registry storage prefix can publish any artifact and deploy any artifact to any environment in that registry. Treat that write access as production code access.

The reason is structural. Some files in the registry are shared by every team:

- `registry.json` lists every published release. Every publish rewrites it.
- `environments/<environment>/deployment.json` records the selected version of every host and app in that environment. Every deploy rewrites it.
- `environments/<environment>/hosts/<host-id>/manifest.json` lists every app deployed to that host. Deploying any app that targets the host rewrites it.

Storage policies can restrict who writes release paths such as `apps/<app-id>/**`, but they cannot give a team write access to "its" entry inside a shared file.

All writers to one registry also share one publication lock, so publish and deploy jobs from different teams run one at a time.

**Recommended practice:**

- Keep storage credentials in a small number of protected CI identities, not in each team's pipeline.
- Let app teams publish freely to a non-production registry, and route production deploys through a pipeline with an approval gate.
- Use a separate environment registry for production, written only by the production pipeline. `npx atlas deploy` reads releases from a source registry and writes environment state to a target registry; see [Use separate artifact and environment registries](production-deployment.md#use-separate-artifact-and-environment-registries).
- Keep audit logs of who published and deployed which version.

## Route and slot ownership

An app declares its routes and slots in its own `atlas.config.ts`. Nothing stops two teams from declaring the same route path on the same host.

What Atlas does today:

- `npx atlas verify` fails with a "route ownership" error when two deployed apps declare the same normalized path on one host.
- At runtime, the host keeps the first placement it reads for a duplicated path, ignores the others, and logs an `ATLAS_DUPLICATE_ROUTE` error to the console. Do not rely on which app wins.
- When several route paths match the current URL, the longest path wins. `/orders/returns` takes precedence over `/orders`.
- Several apps can fill the same slot. Each gets its own container inside the slot anchor. Atlas does not guarantee their order.
- If an app targets a slot that the host layout does not render, the app is not mounted there, and no error is shown to users.

**Recommended practice:**

- Keep a route and slot registry for each host, owned by the host team, and review changes to it like an API change.
- Run `npx atlas verify` against staging in every deploy pipeline so a conflict fails before production.
- Remove or rename a slot only after every app that targets it has stopped doing so.

## Shared dependencies

Apps and hosts load framework packages as shared Native Federation dependencies so that a page runs one copy of each.

What Atlas does today:

- The generated React federation config shares `react`, `react-dom`, the `@atlas/sdk` entry points, and every declared package that an exposed entry imports.
- The generated Angular federation config shares all declared packages through Native Federation's `shareAll`.
- In both, each shared package is a singleton with a strict version, and its required version range comes from the project's own `package.json`.
- `npx atlas publish`, `npx atlas deploy`, and `npx atlas verify` do not compare shared package versions across apps. `atlas verify` only checks that each shared file is reachable.

Because each app is built and released on its own schedule, the versions that meet in the browser are the ones selected in the environment, not the ones any single build saw.

**Recommended practice:**

- Let the host team own the versions of framework packages (React or Angular, and `@atlas/sdk`). Publish the supported ranges and a planned upgrade date.
- Upgrade in this order: widen app ranges so they accept both the old and new versions, deploy those apps, upgrade the host, then narrow the ranges.
- Promote the exact combination you tested. Deploy to production with `--version staging` so production receives what staging ran.
- Avoid sharing packages that hold global state unless every app agrees on the version.

## Host SDK contract changes

Apps call host services through the typed host SDK that the host provides. Changing that contract can break apps that were released earlier and are still deployed.

What Atlas does today:

- An app's `atlas.config.ts` can set `requiredHostSdkVersion`, a version range for the host SDK the app needs. Atlas records it in the app manifest (the default is `^0.1.0`) and validates that it is a string.
- Atlas does not compare `requiredHostSdkVersion` with the host at publish, deploy, verify, or runtime. It is metadata only.

**Recommended practice:**

- Make host SDK changes additive. Add new members; keep old members working until no deployed app uses them.
- Version the host SDK types package with semantic versioning, and have apps declare the range they were built against in `requiredHostSdkVersion`, so the information exists when you need to audit deployed apps.
- Before removing a member, check which deployed app versions still use it, for example by searching the source of the versions listed in `environments/<environment>/deployment.json`.

## Adopt Atlas in an existing single-page app

Atlas expects the Atlas loader to start the host. There is no supported way to mount Atlas apps inside a page that the loader did not start, so adoption starts with the host.

**Recommended practice:** move incrementally, keeping the existing app working at every step.

1. Generate an Atlas host and reproduce your existing shell in its layout: header, navigation, authentication, and a route outlet.
2. Wrap the existing single-page app as one Atlas app with a route at `/`. Route paths match by prefix by default, so this app receives every URL that no other app claims. If its global CSS must reach the page, set `domIsolation` to `shared-dom`; see [Styles and isolation](../concepts/styles-and-isolation.md).
3. Deploy the host and the wrapped app to staging, then to production, and confirm that behavior is unchanged.
4. Move one feature at a time into a new app with a more specific route, such as `/orders`. The longest matching path wins, so the new app takes over that URL space while the wrapped app keeps the rest.
5. Remove the feature's code from the wrapped app after the new app is stable in production.

## Next steps

- [Security](security.md): the trust model behind publish permissions.
- [Production deployment](production-deployment.md): publish, deploy, and promote releases.
- [Production readiness](production-readiness.md): the release checklist.
