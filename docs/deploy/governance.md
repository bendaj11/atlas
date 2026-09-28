---
title: Governance
description: How to run Atlas across many teams, covering ownership, publish permissions, shared dependencies, Host SDK changes, and route conflicts.
---

# Governance

This page helps tech leads and platform owners run Atlas when several teams release Apps independently into shared Hosts. It separates what Atlas enforces today from practices we recommend. Sections marked **Recommended practice** describe process, not product behavior.

## Who owns what

| Owner         | Owns                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Host team     | The Host project, its layout and [host anchors](../concepts/host-anchors.md), the Host SDK services, the bootstrap, and the Host CSP. |
| App teams     | Their App projects, routes, slots, exported Widgets, and release versions.                                                            |
| Platform team | Registry storage, CI identities, the publication lock, CDN configuration, `atlas.runtime.json`, and monitoring.                       |

## Publish and deploy permissions

Atlas has no per-team access control. Any identity that can write to the registry storage prefix can publish any artifact and deploy any artifact to any environment in that registry. Treat that write access as production code access.

The reason is structural. Some files in the registry are shared by every team:

- `registry.json` lists every published release. Every publish rewrites it.
- `environments/<environment>/deployment.json` records the selected version of every Host and App in that environment. Every deploy rewrites it.
- The host deployment manifest `environments/<environment>/hosts/<hostId>/manifest.json` lists every App deployed to that Host. Deploying any App rewrites the manifest of every Host in the environment that any deployed App targets, so one team's deploy can rewrite a Host manifest that another team's Apps appear in.

Storage policies can restrict who writes release paths such as `apps/<appId>/**`, but they cannot give a team write access to "its" entry inside a shared file.

All writers to one registry also share one publication lock, so publish and deploy jobs from different teams run one at a time.

**Recommended practice:**

- Keep storage credentials in a small number of protected CI identities, not in each team's pipeline.
- Let App teams publish freely to a non-production registry, and route production deploys through a pipeline with an approval gate.
- Use a separate environment registry for production, written only by the production pipeline. `npx atlas deploy` reads releases from a source registry and writes environment state to a target registry; see [Use separate artifact and environment registries](production-deployment.md#use-separate-artifact-and-environment-registries).
- Keep audit logs of who published and deployed which version.

## Route and slot ownership

An App declares its routes and slots in its own `atlas.config.ts`. Nothing stops two teams from declaring the same route path on the same Host.

What Atlas does today:

- `npx atlas verify` fails with a "route ownership" error when two deployed Apps declare the same normalized path on one Host.
- At runtime, the Host keeps the first placement it reads for a duplicated path, ignores the others, and logs an `ATLAS_DUPLICATE_ROUTE` error to the console. Do not rely on which App wins.
- When several route paths match the current URL, the longest path wins. `/orders/returns` takes precedence over `/orders`.
- Several Apps can fill the same slot. Each gets its own container inside the slot anchor. Atlas does not guarantee their order.
- If an App targets a slot that the Host layout does not render, the App is not mounted there, and no error is shown to users.

**Recommended practice:**

- Keep a route and slot registry for each Host, owned by the Host team, and review changes to it like an API change.
- Run `npx atlas verify` against staging in every deploy pipeline so a conflict fails before production.
- Remove or rename a slot only after every App that targets it has stopped doing so.

## Shared dependencies

Apps and Hosts load framework packages as shared Native Federation dependencies so that, when versions agree, a page runs one copy of each.

What Atlas does today:

- The generated React federation config shares `react`, `react-dom`, the `@atlas/sdk` entry points, and every declared package that an exposed entry imports.
- The generated Angular federation config shares all declared packages through Native Federation's `shareAll`.
- In both, each shared package is configured with `singleton: true` and `strictVersion: true`, and its required version range comes from the project's own `package.json`. These settings are written into each build's `remoteEntry.json`.
- The `publish`, `deploy`, and `verify` commands do not compare shared package versions across Apps. The `verify` command only checks that each shared file is reachable.

What happens in the browser on a version mismatch:

- Atlas loads modules through the Native Federation runtime (`@softarc/native-federation-runtime`). That runtime does not read `singleton`, `strictVersion`, or the required version range. It matches shared packages by package name and exact version.
- The Host's shared packages go into the page's import map first. When an App shares the same package at exactly the same version as the Host or an App loaded earlier, the App reuses that copy.
- When the version differs, even by a patch release, the runtime maps the package, for that App only, to the App's own bundled copy. The page then runs two copies of the package. There is no error and no console warning.
- Anything that depends on one copy of a package breaks across that boundary: for example React context and hooks shared between Host and App code, Angular injection tokens and root services, and module-level state such as a store. Code inside the App keeps working with its own copy.

Because each App is built and released on its own schedule, the versions that meet in the browser are the ones selected in the environment, not the ones any single build saw.

**Recommended practice:**

- Let the Host team own the versions of framework packages (React or Angular, and `@atlas/sdk`). Publish the supported ranges and a planned upgrade date.
- Keep exact versions of shared packages identical across the Host and every App that runs in one environment, because the runtime reuses a copy only on an exact version match. Pin them with a committed lockfile.
- Upgrade shared packages as a coordinated release: upgrade the Host and the Apps together in a staging environment, verify them there, then promote the same versions to production. Widening a version range alone does not make an App reuse the Host's copy.
- Promote the exact combination you tested. Deploy to production with `--version staging` so production receives what staging ran.
- Avoid sharing packages that hold global state unless every App uses the same exact version.

## Host SDK contract changes

Apps call Host services through the typed Host SDK that the Host provides. Changing that contract can break Apps that were released earlier and are still deployed.

What Atlas does today:

- An App's `atlas.config.ts` can set `requiredHostSdkVersion`, a version range of `@atlas/sdk` that the App expects the Host to run. Atlas validates that the value is a valid semantic version range and records it in the published artifact manifest.
- When an App does not set it, Atlas records the default `^0.1.0`. That range does not match the current `0.5.x` SDK packages, so the recorded value is misleading unless you set it yourself.
- Atlas does not compare `requiredHostSdkVersion` with the Host at publish, deploy, verify, or runtime. A mismatch has no effect. It is metadata only.

**Recommended practice:**

- Make Host SDK changes additive. Add new members; keep old members working until no deployed App uses them.
- Set `requiredHostSdkVersion` in each App to the `@atlas/sdk` range the App was built against, such as `^0.5.7`, so the information exists when you need to audit deployed Apps. Version your own Host SDK types package with semantic versioning too, and record which range an App needs in its `package.json` dependency on that package.
- Before removing a member, check which deployed App versions still use it, for example by searching the source of the versions listed in `environments/<environment>/deployment.json`.

## Adopt Atlas in an existing single-page app

To move an existing single-page app to Atlas one feature at a time, follow [Migrate an existing single-page app](../guides/migrate-existing-spa.md).

## Next steps

- [Security](security.md): the trust model behind publish permissions.
- [Production deployment](production-deployment.md): publish, deploy, and promote releases.
- [Production readiness](production-readiness.md): the release checklist.
- [Migrate an existing single-page app](../guides/migrate-existing-spa.md): adopt Atlas one feature at a time.
